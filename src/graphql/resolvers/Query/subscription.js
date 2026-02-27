// Subscription status resolver for mobile app
const { UserError } = require("graphql-errors");

/**
 * Get subscription status for the current user
 */
const getSubscriptionStatus = async (data, { auth, db: { collections } }) => {
  // Handle both authenticated and guest users
  if (!auth || !auth.id) {
    // Guest user - no subscription
    return {
      isActive: false,
      plan: null,
      expiryDate: null,
      message: "No active subscription. Please sign up or make a payment."
    };
  }

  try {
    // Get user collection
    const UserCollection = collections.user || collections.users;
    
    if (!UserCollection) {
      throw new Error('User collection not available');
    }

    // Find the user
    const user = await UserCollection.findOne({ id: auth.id });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check subscription status
    const isActive = user.subscriptionStatus === 'ACTIVE';
    const isExpired = user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date();

    return {
      isActive: isActive && !isExpired,
      plan: user.subscriptionPlan || null,
      expiryDate: user.subscriptionExpiry || null,
      amount: user.subscriptionAmount || null,
      message: isActive && !isExpired 
        ? `Your ${user.subscriptionPlan || 'subscription'} is active until ${new Date(user.subscriptionExpiry).toLocaleDateString()}`
        : "No active subscription. Please make a payment to continue."
    };

  } catch (error) {
    console.error('[SubscriptionStatus] Error:', error);
    throw new UserError('Failed to get subscription status');
  }
};

/**
 * Check subscription status by phone number
 */
const checkSubscription = async (root, { phone }, { db: { collections } }) => {
  if (!phone) {
    throw new UserError('Phone number is required');
  }

  try {
    const UserCollection = collections.user || collections.users;
    const user = await UserCollection.findOne({ phone });
    
    if (!user) {
      return {
        isActive: false,
        plan: null,
        expiryDate: null,
        message: "No user found with this phone number."
      };
    }

    const isActive = user.subscriptionStatus === 'ACTIVE';
    const isExpired = user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date();

    return {
      isActive: isActive && !isExpired,
      plan: user.subscriptionPlan || null,
      expiryDate: user.subscriptionExpiry || null,
      amount: user.subscriptionAmount || null,
      message: isActive && !isExpired 
        ? `Active ${user.subscriptionPlan || 'subscription'} until ${new Date(user.subscriptionExpiry).toLocaleDateString()}`
        : "No active subscription found."
    };
  } catch (error) {
    console.error('[checkSubscription] Error:', error);
    throw new UserError('Failed to check subscription status');
  }
};

/**
 * Get payment history for the current user
 */
const getPaymentHistory = async (data, { auth, db: { collections } }) => {
  // Handle both authenticated and guest users
  let userId = null;
  
  if (auth && auth.id) {
    userId = auth.id;
  }

  try {
    const PaymentCollection = collections.payment;
    
    if (!PaymentCollection) {
      throw new Error('Payment collection not available');
    }

    // Find payments for this user (or all payments for guest users with phone matching)
    let payments;
    if (userId) {
      // Authenticated user - get their payments
      payments = await PaymentCollection.find({ 
        user: userId,
        isDeleted: false 
      }).sort({ createdAt: 'DESC' }).limit(10);
    } else {
      // Guest user - return empty or require phone number
      return {
        payments: [],
        message: "Please log in to see your payment history"
      };
    }

    return {
      payments: payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        phone: payment.phone,
        description: payment.description,
        merchantRequestID: payment.merchantRequestID,
        checkoutRequestID: payment.checkoutRequestID,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        createdAt: payment.createdAt,
        processedAt: payment.processedAt
      })),
      message: payments.length > 0 ? "Payment history retrieved" : "No payments found"
    };

  } catch (error) {
    console.error('[PaymentHistory] Error:', error);
    throw new UserError('Failed to get payment history');
  }
};

export default () => {
  return {
    getSubscriptionStatus,
    getPaymentHistory,
    checkSubscription
  };
};
