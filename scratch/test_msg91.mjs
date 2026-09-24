import fetch from 'node-fetch';

const widgetId = '36697062464a373338323931';
const tokenAuth = '571687TkSXq4wON6aaa00baP1';
const authKey = '571687AOUJJywEgYQu6aaa0733P1';

async function testWidgetProcess() {
  console.log('Testing MSG91 getWidgetProcess...');
  try {
    const url = `https://control.msg91.com/api/v5/widget/getWidgetProcess?widgetId=${widgetId}&tokenAuth=${tokenAuth}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log('getWidgetProcess result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('getWidgetProcess error:', err);
  }
}

async function testSendOtpMobile() {
  console.log('\nTesting MSG91 sendOtpMobile...');
  try {
    const url = 'https://control.msg91.com/api/v5/widget/sendOtpMobile';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgetId,
        tokenAuth,
        identifier: '919999999999'
      })
    });
    const data = await res.json();
    console.log('sendOtpMobile result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('sendOtpMobile error:', err);
  }
}

async function run() {
  await testWidgetProcess();
  await testSendOtpMobile();
}

run();
