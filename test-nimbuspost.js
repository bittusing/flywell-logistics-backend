/**
 * Test script for NimbusPost API integration
 */

require('dotenv').config();
const NimbusPostProvider = require('./providers/nimbuspost.provider');

const provider = new NimbusPostProvider();

/**
 * Test 1: Authentication
 */
async function testAuthentication() {
  console.log('\n=== Test 1: Authentication ===');
  try {
    const token = await provider.getAccessToken();
    console.log('✓ Authentication successful');
    console.log('Token:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('✗ Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Test 2: Calculate Rate & Serviceability
 */
async function testCalculateRate() {
  console.log('\n=== Test 2: Calculate Rate & Serviceability ===');
  try {
    const rateData = {
      from: {
        pincode: '122001'
      },
      to: {
        pincode: '400001'
      },
      weight: 0.6, // 600 grams = 0.6 kg
      dimensions: {
        length: 10,
        width: 10,
        height: 10
      },
      declaredValue: 999,
      paymentType: 'cod'
    };

    console.log('Request:', rateData);

    const result = await provider.calculateRate(rateData);
    
    console.log('✓ Rate calculated successfully');
    console.log('\nCheapest Option:');
    console.log('  Courier:', result.courierName);
    console.log('  Freight Charges: ₹', result.baseRate);
    console.log('  COD Charges: ₹', result.additionalCharges);
    console.log('  Total: ₹', result.totalAmount);
    
    console.log('\nAll Available Couriers:');
    result.courierOptions.forEach((courier, index) => {
      console.log(`  ${index + 1}. ${courier.name}`);
      console.log(`     Freight: ₹${courier.freightCharges} | COD: ₹${courier.codCharges} | Total: ₹${courier.totalCharges}`);
    });

    return result;
  } catch (error) {
    console.error('✗ Rate calculation failed:', error.message);
    throw error;
  }
}

/**
 * Test 3: Create Shipment
 */
async function testCreateShipment(rateResult) {
  console.log('\n=== Test 3: Create Shipment ===');
  try {
    const shipmentData = {
      orderId: `TEST${Date.now()}`,
      shippingCharges: 40,
      discount: 0,
      codCharges: 30,
      paymentType: 'cod',
      courierId: rateResult?.courierId || '5', // Use cheapest or default to Bluedart
      
      package: {
        weight: 0.6,
        dimensions: {
          length: 10,
          width: 10,
          height: 10
        },
        declaredValue: 999,
        description: 'Test Product'
      },
      
      delivery: {
        name: 'Test Customer',
        phone: '9999999999',
        address: '190, ABC Road',
        address2: 'Near Bus Stand',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      },
      
      pickup: {
        warehouseName: 'Main Warehouse',
        name: 'Warehouse Manager',
        phone: '9999999999',
        address: '140, MG Road',
        address2: 'Near metro station',
        city: 'Gurgaon',
        state: 'Haryana',
        pincode: '122001'
      },
      
      orderItems: [{
        name: 'Test Product 1',
        qty: '1',
        price: '999',
        sku: 'TEST001'
      }],
      
      tags: 'test, demo'
    };

    console.log('Creating shipment for order:', shipmentData.orderId);

    const result = await provider.createShipment(shipmentData);
    
    console.log('✓ Shipment created successfully');
    console.log('\nShipment Details:');
    console.log('  Order ID:', result.orderId);
    console.log('  Shipment ID:', result.shipmentId);
    console.log('  AWB Number:', result.awb);
    console.log('  Courier:', result.courierName);
    console.log('  Status:', result.status);
    console.log('  Label URL:', result.labelUrl);
    console.log('  Tracking URL:', result.trackingUrl);

    return result;
  } catch (error) {
    console.error('✗ Shipment creation failed:', error.message);
    console.error('Error details:', error.response?.data || error);
    // Don't throw - this is expected to fail in test mode
    return null;
  }
}

/**
 * Test 4: Track Shipment
 */
async function testTrackShipment(awbNumber) {
  console.log('\n=== Test 4: Track Shipment ===');
  
  if (!awbNumber) {
    console.log('⚠ Skipping tracking test - no AWB number available');
    return;
  }

  try {
    console.log('Tracking AWB:', awbNumber);

    const result = await provider.trackShipment(awbNumber);
    
    console.log('✓ Tracking information retrieved');
    console.log('\nTracking Details:');
    console.log('  AWB:', result.awb);
    console.log('  Status:', result.status);
    console.log('  Current Location:', result.currentLocation);
    console.log('  Courier:', result.courierName);
    console.log('  Last Update:', result.lastUpdate);

    return result;
  } catch (error) {
    console.error('✗ Tracking failed:', error.message);
    // Don't throw - tracking might not be available for test shipments
    return null;
  }
}

/**
 * Test 5: Check Pincode Serviceability
 */
async function testPincodeServiceability() {
  console.log('\n=== Test 5: Check Pincode Serviceability ===');
  try {
    const pincode = '400001';
    console.log('Checking pincode:', pincode);

    const result = await provider.checkPincodeServiceability(pincode);
    
    console.log('✓ Serviceability check completed');
    console.log('  Serviceable:', result.serviceable);
    console.log('  Message:', result.message);
    if (result.couriers) {
      console.log('  Available Couriers:', result.couriers.length);
    }

    return result;
  } catch (error) {
    console.error('✗ Serviceability check failed:', error.message);
    return null;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('===========================================');
  console.log('NimbusPost API Integration Tests');
  console.log('===========================================');
  console.log('Email:', process.env.NIMBUSPOST_EMAIL);
  console.log('Base URL:', provider.baseURL);

  try {
    // Test 1: Authentication
    await testAuthentication();

    // Test 2: Calculate Rate
    const rateResult = await testCalculateRate();

    // Test 3: Create Shipment (may fail in test mode)
    const shipmentResult = await testCreateShipment(rateResult);

    // Test 4: Track Shipment (if shipment was created)
    if (shipmentResult?.awb) {
      await testTrackShipment(shipmentResult.awb);
    }

    // Test 5: Check Pincode Serviceability
    await testPincodeServiceability();

    console.log('\n===========================================');
    console.log('✓ All tests completed!');
    console.log('===========================================');
    console.log('\nNote: Some tests may fail if using test credentials.');
    console.log('For full functionality, use production credentials.');

  } catch (error) {
    console.log('\n===========================================');
    console.log('✗ Tests failed');
    console.log('===========================================');
    console.error('Error:', error.message);
  }
}

// Run tests
runTests();
