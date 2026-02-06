const fetch = require('node-fetch');

/**
 * Vercel Serverless Function
 * endpoint: /api/generate
 */
module.exports = async (req, res) => {
    // CORS 設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // プリフライトリクエスト (OPTIONS) への対応
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    try {
        const { accessCode, ...geminiPayload } = req.body;

        // アクセスコードの検証
        const validCode = process.env.ACCESS_CODE || 'darumaya';
        if (accessCode !== validCode) {
            return res.status(403).json({ error: { message: 'アクセスコードが正しくありません。' } });
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
        res.status(response.status).json(data);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: { message: 'サーバー内部エラーが発生しました。' } });
    }
};
