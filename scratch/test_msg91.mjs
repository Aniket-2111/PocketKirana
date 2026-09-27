import fetch from 'node-fetch';

const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '';
const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_KEY || '';
const authKey = process.env.MSG91_AUTHKEY || '';

async function testWidgetProcess() {
  if (!widgetId || !tokenAuth) {
    console.log('MSG91 credentials not set in environment.');
    return;
  }
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

async function run() {
  await testWidgetProcess();
}

run();
