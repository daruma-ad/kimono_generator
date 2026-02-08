const { kv } = require('@vercel/kv');
const fetch = require('node-fetch');

/**
 * Vercel Serverless Function
 * endpoint: /api/generate
 */
module.exports = async (req, res) => {
    // CORS 設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // プリフライトリクエスト (OPTIONS) への対応
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 環境変数から回数制限を取得（未設定ならデフォルト3）
    const dailyLimit = parseInt(process.env.DAILY_LIMIT || '3', 10);

    // GET リクエストの場合は設定情報を返す
    if (req.method === 'GET') {
        return res.status(200).json({ dailyLimit });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    try {
        const { accessCode, ...geminiPayload } = req.body;

        // アクセスコードの検証 (キャッシュ回避のためのIP制限の前に実行)
        const validCode = process.env.ACCESS_CODE || 'darumaya';
        if (accessCode !== validCode) {
            return res.status(403).json({ error: { message: 'アクセスコードが正しくありません。' } });
        }

        // IPベースの利用制限チェック (Vercel KVを使用)
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const today = new Date().toISOString().split('T')[0];
        const limitKey = `limit:${ip}:${today}`;

        const currentUsage = await kv.get(limitKey) || 0;
        if (currentUsage >= dailyLimit) {
            return res.status(429).json({ error: { message: `本日の利用上限（${dailyLimit}回）に達しました。また明日お試しください。` } });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_api_key_here') {
            return res.status(500).json({ error: { message: 'APIキーが設定されていません。Vercelの環境変数を確認してください。' } });
        }

        const model = 'gemini-3-pro-image-preview';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();

        // 画像生成に成功した場合のみ回数をカウントアップ
        if (response.ok && data.candidates?.[0]?.content?.parts?.some(p => p.inlineData)) {
            await kv.incr(limitKey);
            await kv.expire(limitKey, 86400); // 24時間で自動消去
        }

        res.status(response.status).json(data);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: { message: 'サーバー内部エラーが発生しました。' } });
    }
};
