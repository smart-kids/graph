const fs = require('fs');
const path = require('path');

// Read the package.json file from the root
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

// Create a new package.json with only dependencies and engine field
const newPackageJson = {
  dependencies: packageJson.dependencies,
  engines: {
    node: "20"
  }
};

// Write the new package.json to the dist folder
fs.writeFileSync(path.resolve(__dirname, 'dist', 'package.json'), JSON.stringify(newPackageJson, null, 2), 'utf8');

// Copy schema.graphql file to dist folder
fs.copyFileSync(path.resolve(__dirname, 'schema.graphql'), path.resolve(__dirname, 'dist', 'schema.graphql'));

console.log("package.json and schema.graphql copied to dist with dependencies and engine set to 20");
