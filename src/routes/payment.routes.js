const express = require('express');
const axios = require('axios');
const router = express.Router();

// ===== 1. INITIATE PAYMENT =====
router.post('/initiate', async (req, res) => {
  try {
    const { amount, email, phoneNumber, name } = req.body;

    const tx_ref = `TX-${Date.now()}`; // Unique transaction reference

    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref,
        amount,
        currency: 'NGN',
        redirect_url: `${process.env.BASE_URL}/api/payments/verify`,
        customer: {
          email,
          phonenumber: phoneNumber,
          name
        },
        customizations: {
          title: 'Car Rental Payment',
          description: 'Payment for rented car',
          logo: 'https://example.com/logo.png'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
        }
      }
    );

    return res.json({
      status: 'success',
      paymentLink: response.data.data.link
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// ===== 2. VERIFY PAYMENT AFTER REDIRECT =====
router.get('/verify', async (req, res) => {
  const { transaction_id } = req.query;

  try {
    const verifyResponse = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
        }
      }
    );

    const paymentData = verifyResponse.data.data;

    if (verifyResponse.data.status === 'success' && paymentData.status === 'successful') {
      // TODO: Save payment record to DB
      console.log('✅ Payment verified:', paymentData);

      return res.send('Payment successful! You can close this page.');
    } else {
      return res.send('Payment verification failed.');
    }
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).send('Error verifying payment.');
  }
});

// ===== 3. WEBHOOK HANDLER =====
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers['verif-hash'];

  if (!signature || signature !== secretHash) {
    return res.status(401).send('Unauthorized');
  }

  const event = JSON.parse(req.body.toString());

  console.log('📩 Webhook received:', event);

  if (event.event === 'charge.completed' && event.data.status === 'successful') {
    // TODO: Update order/payment status in DB
    console.log(`✅ Webhook confirms payment for ${event.data.tx_ref}`);
  }

  return res.status(200).send('Webhook received');
});

module.exports = router;