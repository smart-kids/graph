const { execSync, exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Configuration
const CRDB_HOST = process.env.CRDB_HOST || 'localhost:26257';
const ADMIN_UI = process.env.CRDB_UI || 'http://localhost:8080';
const LOG_FILE = 'cluster_operations.log';
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Logging setup
function logOperation(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${isError ? 'ERROR:' : ''} ${message}\n`;
  
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(logEntry.trim());
}

// Health check functions
async function checkClusterHealth() {
  try {
    logOperation("Running pre-scale health checks...");
    
    // 1. Verify all nodes are live
    const nodesUp = execSync(
      `cockroach node status --insecure --host=${CRDB_HOST} | grep '^[0-9]' | wc -l`
    ).toString().trim();
    
    // 2. Check for under-replicated ranges
    const underReplicated = execSync(
      `cockroach sql --insecure --host=${CRDB_HOST} -e "SELECT count(*) FROM crdb_internal.ranges WHERE under_replicated = true;"`
    ).toString().trim();
    
    // 3. Verify no deadlocks
    const deadlocks = execSync(
      `cockroach sql --insecure --host=${CRDB_HOST} -e "SELECT count(*) FROM crdb_internal.node_transaction_statistics WHERE contention_time > '1s';"`
    ).toString().trim();
    
    // 4. Check for corrupt replicas
    const corruptReplicas = execSync(
      `cockroach debug doctor inspect replicas --insecure --host=${CRDB_HOST} | grep -i corrupt | wc -l`
    ).toString().trim();

    logOperation(`Health Check Results:
    - Nodes Available: ${nodesUp}
    - Under-replicated ranges: ${underReplicated}
    - Transactions with contention: ${deadlocks}
    - Corrupt replicas detected: ${corruptReplicas}`);

    if (parseInt(underReplicated) > 0 || parseInt(corruptReplicas) > 0) {
      throw new Error('Cluster health check failed - potential data integrity issues detected');
    }

    return true;
  } catch (err) {
    logOperation(`Health check failed: ${err.message}`, true);
    return false;
  }
}

// Data corruption detection
async function detectDataCorruption() {
  try {
    logOperation("Running data integrity checks...");
    
    // 1. Verify checksums
    execSync(
      `cockroach debug doctor inspect checksums --insecure --host=${CRDB_HOST}`
    );
    
    // 2. Check replica consistency
    const inconsistent = execSync(
      `cockroach debug doctor inspect replicas --insecure --host=${CRDB_HOST} | grep -i inconsistent | wc -l`
    ).toString().trim();
    
    if (parseInt(inconsistent) > 0) {
      throw new Error(`${inconsistent} inconsistent replicas detected`);
    }
    
    logOperation("Data integrity verified - no corruption detected");
    return true;
  } catch (err) {
    logOperation(`Data corruption detected: ${err.message}`, true);
    return false;
  }
}

// Scaling operations
async function scaleCluster(newNodeCount) {
  try {
    // Pre-scale checks
    if (!(await checkClusterHealth())) {
      throw new Error('Aborting scale operation due to cluster health issues');
    }

    const currentNodes = parseInt(
      execSync('docker-compose ps cockroach | grep Up | wc -l').toString()
    );

    if (newNodeCount <= currentNodes) {
      logOperation(`Cluster already has ${currentNodes} nodes`);
      return;
    }

    // Scale operation
    logOperation(`Scaling from ${currentNodes} to ${newNodeCount} nodes`);
    execSync(`docker-compose up -d --scale cockroach=${newNodeCount}`);
    
    // Wait for new nodes to initialize
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
    
    // Initialize new nodes
    for (let i = currentNodes; i < newNodeCount; i++) {
      logOperation(`Initializing node cockroach_${i+1}`);
      execSync(`docker-compose run --rm init --host=cockroach_${i+1}`);
    }

    // Post-scale validation
    logOperation("Running post-scale validation...");
    await validateClusterState(newNodeCount);
    await detectDataCorruption();
    
    // Rebalance if needed
    const underReplicated = execSync(
      `cockroach sql --insecure --host=${CRDB_HOST} -e "SELECT count(*) FROM crdb_internal.ranges WHERE under_replicated = true;"`
    ).toString().trim();
    
    if (parseInt(underReplicated) > 0) {
      logOperation("Rebalancing cluster ranges...");
      execSync(`cockroach sql --insecure --host=${CRDB_HOST} -e "SET CLUSTER SETTING kv.snapshot_rebalance.max_rate='128MiB';"`);
      execSync(`cockroach sql --insecure --host=${CRDB_HOST} -e "ALTER RANGE DEFAULT CONFIGURE ZONE USING num_replicas=${Math.min(5, newNodeCount)};"`);
    }

    logOperation(`Successfully scaled to ${newNodeCount} nodes`);
  } catch (err) {
    logOperation(`Scaling failed: ${err.message}`, true);
    await attemptRecovery();
  }
}

async function validateClusterState(expectedNodes) {
  try {
    logOperation("Validating cluster state...");
    
    // Verify all nodes joined
    const nodesActive = execSync(
      `cockroach node status --insecure --host=${CRDB_HOST} | grep '^[0-9]' | wc -l`
    ).toString().trim();
    
    if (parseInt(nodesActive) !== expectedNodes) {
      throw new Error(`Expected ${expectedNodes} nodes but found ${nodesActive}`);
    }
    
    // Verify no ranges in bad state
    const badRanges = execSync(
      `cockroach sql --insecure --host=${CRDB_HOST} -e "SELECT count(*) FROM crdb_internal.ranges WHERE split_enforced_until IS NOT NULL OR lease_status != 'VALID';"`
    ).toString().trim();
    
    if (parseInt(badRanges) > 0) {
      throw new Error(`${badRanges} ranges in problematic state detected`);
    }
    
    logOperation("Cluster state validated successfully");
  } catch (err) {
    throw new Error(`Cluster validation failed: ${err.message}`);
  }
}

// Recovery procedures
async function attemptRecovery() {
  try {
    logOperation("Attempting automatic recovery...");
    
    // 1. Check if quorum is lost
    const nodesUp = execSync(
      `cockroach node status --insecure --host=${CRDB_HOST} | grep '^[0-9]' | wc -l`
    ).toString().trim();
    
    if (parseInt(nodesUp) < 3) {
      logOperation("Critical: Quorum lost - manual intervention required", true);
      return false;
    }
    
    // 2. Try to repair ranges
    execSync(
      `cockroach debug recover verify --insecure --host=${CRDB_HOST}`
    );
    
    // 3. Rebalance if possible
    execSync(
      `cockroach sql --insecure --host=${CRDB_HOST} -e "SET CLUSTER SETTING kv.snapshot_rebalance.max_rate='64MiB';"`
    );
    
    logOperation("Recovery procedures completed");
    return true;
  } catch (err) {
    logOperation(`Recovery failed: ${err.message}`, true);
    return false;
  }
}

// Interactive menu
async function showMenu() {
  console.log(`
  Enhanced CockroachDB Cluster Manager
  -----------------------------------
  1. Scale cluster
  2. Run health checks
  3. Check for data corruption
  4. View operation logs
  5. Exit
  `);

  rl.question('Select operation: ', async (choice) => {
    switch(choice) {
      case '1':
        const nodeCount = await askQuestion('Enter desired node count: ');
        await scaleCluster(parseInt(nodeCount));
        break;
      case '2':
        await checkClusterHealth();
        break;
      case '3':
        await detectDataCorruption();
        break;
      case '4':
        console.log(fs.readFileSync(LOG_FILE, 'utf8'));
        break;
      case '5':
        rl.close();
        return;
      default:
        console.log('Invalid choice');
    }
    showMenu();
  });
}

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Initialize
logOperation("Cluster management session started");
showMenu();