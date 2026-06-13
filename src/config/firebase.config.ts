import * as admin from 'firebase-admin';

// All Firebase Credentials
export const FIREBASE_CONFIG = {
    projectId: 'dash-flow-8a6dd',
    apiKey: 'AIzaSyBh-iPDjfgl7_yan7nOZQK-6YOJNx22aiY',
    authDomain: 'dash-flow-8a6dd.firebaseapp.com',
    storageBucket: 'dash-flow-8a6dd.firebasestorage.app',
    messagingSenderId: '1077355823086',
    appId: '1:1077355823086:web:8ac50a1e536e7b27f958ff',
    
    // Admin Service Account Details
    clientEmail: 'firebase-adminsdk-fbsvc@dash-flow-8a6dd.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDOY8k+rkGY9JOd\nbbBtycgI+d/7mU6I2Kjn8qvsSGzVorK2vTNIR9lsWpFL9rqcDe3NgtJsVjvDd/pB\nHzYiYgZXvdhroJRjp77GaaHPM1kTEStwyvv9/r2qiD0ZZBUXrGBdFWDytElj0OhT\naYrwmz6Szek+Xp1U6c9hoEbcsb/AH2qc9Zpl2SStAL/UZNGnqanBajuitMfpTqwC\nTYLtbuvf8Tyfr/L+4pjgJ8HqIK2UsyVDVVxaGWo8x7tEWkAwu+cma4IFDAA+xUOk\n5c9Q+zIUICe0lY/WrqC6/YCbWT8zCqndjrbRLJOYNIDvtcP8mP+ndR+mVfO7P2ph\nZcuztB89AgMBAAECggEAKB/ELxhnjln2HMQHacCxz/TsM5jBaN9eLwHBpMULy5i+\nz8IGp0W4olUVLESCUPZwReTqDb/SDJVVpLVxq8uM2iABZCMq1hj1gNNmbsbXyVos\nLNh5lw6gRvgHkNkhNKIBdfdDCsw7/FjP4e+B4Hb9+kJn1wVD5w8xjxQ+0ocH9UyM\nrVdOyg7XEWLmJNCESW6Lma1E9Q+RUb2sI4KKcQnZc8ShdgjvKiMsaDHnQmvlmofa\ng6QEpWRlNWjkW4+3SHm6Zmjp3pJzNqbXU1WHne7IBuxoOYE7pyECNCbaOQcVte4t\npWpKRhocPzHPk/B5AgyHwH0IDx1BXNeVN4ZkZMzlDQKBgQD2/My6D0OKcYKTdq1f\njymkCyDpPHXHvnxVmtxyr66DpTDRB8VmNiOtMx8O3+EekOG/xIfKjQ/xgj6AbqP8\nyB7ZbXEoV15unn5EytySDD3Je99+86ZwRQAMiRs3WYU51OZ8Jtd+Rhpc0ySq1fke\nJo14/KWaE5EzSjJwfcolL/5wmwKBgQDV67+WoZPU8D8m94hJSeQfgaqeHzAlAswc\neTCbeK1o5nYiHxdkhGJIYDazzAnUm215mR0XIJTNQx+l1saAU1rzjyitor2/akRs\nku5lhlq25s5USTuxbyZItCSqJWk75hcWMYXmViO1JWzE7SZ/Kt1/dB91k6BQcYOP\nwfsXjTpRBwKBgCavd/2YkHKpztL8HrG+Ab6xA4mkr6oGmwDpjafk/oeeIyRKfE/D\nIRlqzW2OAXvBI6rexIokSCACz3lcWxEn4zUZIEU6Ug8vggWSZLP3eOILJfmDfklN\ndXGBNCMaQXTKdQNzLgOYRV7Or4qWkzt2vGf74pBcijynXXkjKrtiZg8LAoGAaOIB\nOVVXKdvw2qYah/RWiKwGfyhDbqIEeSFiF5f/TaNQ4EHmMj5GAb5Kk7TCTR83eZr8\njE5JJqp2ZdT71gcIXMof46Ia7jKoAaO4hsZsy6g2GVUek0wvtQ29vD5Dbj7Nqu/0\n+o3ZTANhZNvxOABIQSkqE3eh7k75dg5hkZaItRkCgYEA6kXZW4PHyGSStQ2ruwqa\n3vyYX5EyvCyzHvAVst04chRZHUm6kRiBBrdxku9nYxPFV+QuSZFVsWwidIq9mFYC\nsZwETk9Z3BWrcFu5AtC7128cAAZYgpI3zeBHkA0/AmFp3mYz/IXz49HunGY31dYF\nr+UsVBiQ9Mh51v5lb7cG64E=\n-----END PRIVATE KEY-----\n',
};

if (!admin.apps.length) {
    if (FIREBASE_CONFIG.clientEmail && FIREBASE_CONFIG.privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: FIREBASE_CONFIG.projectId,
                clientEmail: FIREBASE_CONFIG.clientEmail,
                privateKey: FIREBASE_CONFIG.privateKey.replace(/\\n/g, '\n'),
            }),
        });
        console.log('[Firebase] Admin initialized with credentials successfully');
    } else {
        // Fallback to basic project ID if private key is missing
        admin.initializeApp({
            projectId: FIREBASE_CONFIG.projectId,
        });
        console.warn('[Firebase] Admin initialized without explicit credentials. (Missing clientEmail/privateKey in config)');
    }
}

export const firebaseAdmin = admin;
export const firestore = admin.firestore();
export const messaging = admin.messaging();
