import axios from 'axios';

async function testWebhook() {
    const baseUrl = 'http://localhost:3001/api/webhooks/youtube';

    console.log('🧪 Testing YouTube Webhook...');

    // 1. Test GET (Verification)
    try {
        console.log('\n📡 Testing GET Verification...');
        const challenge = 'random_challenge_string';
        const response = await axios.get(baseUrl, {
            params: {
                'hub.challenge': challenge,
                'hub.topic': 'https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...',
                'hub.mode': 'subscribe'
            }
        });

        if (response.status === 200 && response.data === challenge) {
            console.log('✅ GET Verification passed!');
        } else {
            console.error('❌ GET Verification failed:', response.status, response.data);
        }
    } catch (error: any) {
        console.error('❌ GET Verification error:', error.message);
    }

    // 2. Test POST (Notification)
    try {
        console.log('\n📨 Testing POST Notification...');

        // Valid XML payload with date in title
        const xmlBody = `
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
      <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
      <link rel="self" href="https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC..."/>
      <title>Video Feed</title>
      <updated>2026-02-12T00:00:00+00:00</updated>
      <entry>
        <id>yt:video:VIDEO_ID_123</id>
        <yt:videoId>VIDEO_ID_123</yt:videoId>
        <yt:channelId>CHANNEL_ID</yt:channelId>
        <title>Viana - 12/02/2026 - Extra</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=VIDEO_ID_123"/>
        <author>
          <name>Channel Name</name>
          <uri>https://www.youtube.com/channel/CHANNEL_ID</uri>
        </author>
        <published>2026-02-12T00:00:00+00:00</published>
        <updated>2026-02-12T00:00:00+00:00</updated>
      </entry>
    </feed>`;

        const response = await axios.post(baseUrl, xmlBody, {
            headers: {
                'Content-Type': 'application/atom+xml'
            }
        });

        if (response.status === 200) {
            console.log('✅ POST Notification passed (Status 200)');
            console.log('Check server logs to see if "Extracted Date" and "WhatsApp message" were logged (if a game existed for that date).');
        } else {
            console.error('❌ POST Notification failed:', response.status);
        }

    } catch (error: any) {
        console.error('❌ POST Notification error:', error.message);
    }
}

testWebhook();
