import { messaging } from './src/config/firebase.config';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// The exact token we retrieved from the database
// const TARGET_TOKEN = "cvafZ86Y-35O28rZTZVB82:APA91bHXRnUmgrYA4qp8xB67q2BUEA2Iy5DYN7HOJ34ltQWnjuEPlbPaNjRqr4x-cDTDiyEkNVuomxM9TvjrFDAqRVwpzMzESDyl_fiVaMiC1ZdQNtSOufM";

async function sendTestPush() {
    console.log(`\n Preparing to send push notification to ALL users...`);

    // Connect to database
    const dbUrl = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
    const client = new Client({
        connectionString: dbUrl,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT token, platform FROM fcm_token');
        const activeDevices = res.rows.filter(row => row.token);

        if (activeDevices.length === 0) {
            console.log("No FCM tokens found in the database.");
            return;
        }

        console.log(`Found ${activeDevices.length} active FCM tokens in database:\n`);
        activeDevices.forEach((device, index) => {
            console.log(`[${index + 1}] Platform: ${device.platform.toUpperCase()} | Token: ${device.token.substring(0, 15)}...`);
        });

        const allTokens = activeDevices.map(d => d.token);

        const payload = {
            tokens: allTokens,
            notification: {
                title: "Global Broadcast Successful!",
                body: "This is a mass notification sent to all connected users across DashFlow.",
            },
            data: {
                type: "SYSTEM_BROADCAST",
                timestamp: Date.now().toString()
            }
        };

        const response = await messaging.sendEachForMulticast(payload);
        console.log('\n Successfully sent multicast message!');
        console.log(`Success count: ${response.successCount}`);
        console.log(`Failure count: ${response.failureCount}`);

        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Failed to send to token [${idx}]:`, resp.error);
                }
            });
        }
        console.log('Check your screens to see if the notification popped up!\n');
    } catch (error) {
        console.error('\n Error sending message:');
        console.error(error);
    } finally {
        await client.end();
    }
}

sendTestPush();