import axios from '../server/node_modules/axios/index.js';

async function testPost() {
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbz15QoF7sNWv8GiodcLViPYeK_ju1YWRMPbYcAqHoV6Ks9-11_LMVgGHNdgwtqrlbGKsw/exec';
  const payload = {
    headers: ['Rank', 'Academic Year', 'Department', 'Section', 'Allocation Batch', 'Mentor', 'Register No', 'Student Name', 'LeetCode ID', '22-Aug-26'],
    rows: [
      ['1', '2023–2027', 'CSE', 'Section CSE Batch-3', 'Dr.A.Muthuraj', '814723104001', 'DHIPAK S', 'Dhipak_S', 'Overall: 34E | 18M | 6H | 58T\nToday: +0E | +0M | +0H | +0T'],
      ['2', '2023–2027', 'CSE', 'Section CSE Batch-3', 'Dr.A.Muthuraj', '814723104002', 'GOKULRAM', 'Gokulram_V', 'Overall: 51E | 3M | 1H | 55T\nToday: +0E | +0M | +0H | +0T']
    ],
    studentCount: 2,
    updatedAt: new Date().toISOString()
  };

  try {
    console.log('Posting to Apps Script Webhook:', webhookUrl);
    const response = await axios.post(webhookUrl, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      maxRedirects: 5,
    });
    console.log('Apps Script Webhook Response Status:', response.status);
    console.log('Apps Script Webhook Response Data:', response.data);
  } catch (err: any) {
    console.error('Apps Script Webhook Error:', err?.message || err);
  }
}

testPost();
