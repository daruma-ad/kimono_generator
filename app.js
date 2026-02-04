/**
 * 着物バーチャル試着アプリ
 * Gemini APIを使用した顔合成機能
 */

// ===================================
// 設定
// ===================================
const CONFIG = {
    // 着物データ（モデル画像を配置後に更新）
    kimonos: [
        {
            id: 1,
            name: '振袖 1',
            image: 'images/NO1.png',
            description: 'A stunning purple furisode (long-sleeved kimono) with vibrant gold and green floral patterns featuring peonies and chrysanthemums. Golden obi belt with intricate embroidery. Traditional Japanese formal style.'
        },
        {
            id: 2,
            name: '振袖 2',
            image: 'images/NO2.png',
            description: 'An elegant deep green furisode with black gradients at the bottom, decorated with golden fans, cherry blossoms, and traditional Japanese motifs. Purple obi belt with plum blossom patterns.'
        },
        {
            id: 3,
            name: '振袖 3',
            image: 'images/NO3.png',
            description: 'A sophisticated cream and gold furisode with delicate chrysanthemum patterns and golden embroidery. Elegant gold obi belt. Refined and luxurious appearance.'
        },
        {
            id: 4,
            name: '振袖 4',
            image: 'images/NO4.png',
            description: 'A modern navy blue kimono with subtle patterns, paired with a dark brown obi belt. Simple yet elegant design suitable for formal occasions.'
        },
        {
            id: 5,
            name: '振袖 5',
            image: 'images/NO5.png',
            description: 'A contemporary navy blue kimono with a brown/beige haori jacket layered on top. Artistic abstract patterns on the obi. Modern Japanese style.'
        },
        {
            id: 6,
            name: '振袖 6',
            image: 'images/NO6.png',
            description: 'A classic cream-colored furisode with golden and orange floral patterns featuring fans and traditional motifs. Elegant gold obi belt. Traditional formal style.'
        }
    ],

    // Gemini API設定
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent',

    // ローカルストレージキー
    storageKeys: {
        apiKey: 'kimono_app_api_key'
    }
};

// ===================================
// ステート管理
// ===================================
const state = {
    selectedKimono: null,
    customerPhoto: null,
    customerPhotoBase64: null,
    isGenerating: false
};

// ===================================
// DOM要素
// ===================================
const elements = {
    kimonoGrid: document.getElementById('kimonoGrid'),
    uploadArea: document.getElementById('uploadArea'),
    photoInput: document.getElementById('photoInput'),
    previewImage: document.getElementById('previewImage'),
    generateBtn: document.getElementById('generateBtn'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    resultSection: document.getElementById('resultSection'),
    resultImage: document.getElementById('resultImage'),
    saveBtn: document.getElementById('saveBtn'),
    shareBtn: document.getElementById('shareBtn'),
    retryBtn: document.getElementById('retryBtn'),
    apiModal: document.getElementById('apiModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKey: document.getElementById('saveApiKey'),
    settingsBtn: document.getElementById('settingsBtn')
};

// ===================================
// 初期化
// ===================================
function init() {
    renderKimonoGrid();
    setupEventListeners();
    checkApiKey();
    registerServiceWorker();
}

// ===================================
// 着物グリッドのレンダリング
// ===================================
function renderKimonoGrid() {
    elements.kimonoGrid.innerHTML = CONFIG.kimonos.map(kimono => `
        <div class="kimono-card" data-id="${kimono.id}">
            <img src="${kimono.image}" alt="${kimono.name}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22><rect fill=%22%2316213e%22 width=%22100%22 height=%22133%22/><text x=%2250%22 y=%2270%22 text-anchor=%22middle%22 fill=%22%238b4c70%22 font-size=%2240%22>👘</text></svg>'">
            <span class="kimono-name">${kimono.name}</span>
            <span class="check-icon">✓</span>
        </div>
    `).join('');
}

// ===================================
// イベントリスナー設定
// ===================================
function setupEventListeners() {
    // 着物選択
    elements.kimonoGrid.addEventListener('click', handleKimonoSelect);

    // 写真アップロード
    elements.uploadArea.addEventListener('click', () => elements.photoInput.click());
    elements.photoInput.addEventListener('change', handlePhotoUpload);

    // ドラッグ&ドロップ
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('has-image');
    });
    elements.uploadArea.addEventListener('dragleave', () => {
        if (!state.customerPhoto) {
            elements.uploadArea.classList.remove('has-image');
        }
    });
    elements.uploadArea.addEventListener('drop', handlePhotoDrop);

    // 生成ボタン
    elements.generateBtn.addEventListener('click', handleGenerate);

    // 結果アクション
    elements.saveBtn.addEventListener('click', handleSave);
    elements.shareBtn.addEventListener('click', handleShare);
    elements.retryBtn.addEventListener('click', handleRetry);

    // API設定
    elements.settingsBtn.addEventListener('click', () => showModal(true));
    elements.saveApiKey.addEventListener('click', saveApiKey);
    elements.apiModal.addEventListener('click', (e) => {
        if (e.target === elements.apiModal) showModal(false);
    });
}

// ===================================
// 着物選択処理
// ===================================
function handleKimonoSelect(e) {
    const card = e.target.closest('.kimono-card');
    if (!card) return;

    // 選択状態を更新
    document.querySelectorAll('.kimono-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    const kimonoId = parseInt(card.dataset.id);
    state.selectedKimono = CONFIG.kimonos.find(k => k.id === kimonoId);

    updateGenerateButton();
}

// ===================================
// 写真アップロード処理
// ===================================
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (file) processPhoto(file);
}

function handlePhotoDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        processPhoto(file);
    }
}

async function processPhoto(file) {
    state.customerPhoto = file;

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.previewImage.src = e.target.result;
        elements.uploadArea.classList.add('has-image');

        // Base64を保存（APIリクエスト用）
        state.customerPhotoBase64 = e.target.result.split(',')[1];
        updateGenerateButton();
    };
    reader.readAsDataURL(file);
}

// ===================================
// 生成ボタン状態更新
// ===================================
function updateGenerateButton() {
    const canGenerate = state.selectedKimono && state.customerPhoto && getApiKey();
    elements.generateBtn.disabled = !canGenerate;
}

// ===================================
// 画像生成処理
// ===================================
async function handleGenerate() {
    if (state.isGenerating) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        showModal(true);
        return;
    }

    state.isGenerating = true;
    showLoading(true);

    try {
        // 着物の説明テキストを取得
        const kimonoDescription = state.selectedKimono.description;

        // Gemini APIにリクエスト（顔写真のみ + 着物テキスト説明）
        const response = await fetch(`${CONFIG.apiEndpoint}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: state.customerPhotoBase64
                            }
                        },
                        {
                            text: `Create a professional full-length portrait photograph for a kimono catalog.

SUBJECT: A Japanese woman whose face resembles the uploaded photo.

KIMONO: ${kimonoDescription}

COMPOSITION (CRITICAL):
- VERTICAL/PORTRAIT orientation (3:4 aspect ratio)
- FULL LENGTH shot from head to tabi (Japanese socks) - MUST show entire body including feet
- The kimono sleeves (furisode) must be fully visible
- DO NOT crop at waist or chest - show the COMPLETE outfit

STYLING:
- Elegant updo hairstyle with traditional hair ornaments (kanzashi)
- Standing pose, hands gently clasped in front
- Slight smile, looking at camera
- Professional studio lighting, white/cream background

The image MUST show the complete kimono from collar to hem. Full body is absolutely required.`
                        }
                    ]
                }],
                generationConfig: {
                    responseModalities: ['image', 'text']
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API呼び出しに失敗しました');
        }

        const data = await response.json();

        // 生成された画像を取得
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (imagePart) {
            const imageData = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            showResult(imageData);
        } else {
            // 画像生成ができなかった場合のフォールバック
            const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
            throw new Error(textPart?.text || '画像の生成に失敗しました。もう一度お試しください。');
        }

    } catch (error) {
        console.error('Generation error:', error);
        alert(`エラー: ${error.message}`);
    } finally {
        state.isGenerating = false;
        showLoading(false);
    }
}

// ===================================
// 画像をBase64に変換
// ===================================
async function imageToBase64(imagePath) {
    const response = await fetch(imagePath);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ===================================
// ローディング表示
// ===================================
function showLoading(show) {
    if (show) {
        elements.generateBtn.style.display = 'none';
        elements.loadingIndicator.classList.add('active');
    } else {
        elements.generateBtn.style.display = 'flex';
        elements.loadingIndicator.classList.remove('active');
    }
}

// ===================================
// 結果表示
// ===================================
function showResult(imageData) {
    elements.resultImage.src = imageData;
    elements.resultSection.classList.add('active');

    // 結果セクションにスクロール
    elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===================================
// 保存処理
// ===================================
function handleSave() {
    const link = document.createElement('a');
    link.download = `kimono_${Date.now()}.png`;
    link.href = elements.resultImage.src;
    link.click();
}

// ===================================
// シェア処理
// ===================================
async function handleShare() {
    if (navigator.share) {
        try {
            // 画像をBlobに変換
            const response = await fetch(elements.resultImage.src);
            const blob = await response.blob();
            const file = new File([blob], 'kimono.png', { type: 'image/png' });

            await navigator.share({
                title: '着物バーチャル試着',
                text: '着物姿を体験しました！ 👘',
                files: [file]
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                // Web Share APIが使えない場合はダウンロード
                handleSave();
            }
        }
    } else {
        // 非対応ブラウザ
        handleSave();
    }
}

// ===================================
// リトライ処理
// ===================================
function handleRetry() {
    elements.resultSection.classList.remove('active');

    // 着物選択に戻る
    document.querySelector('.step-section').scrollIntoView({ behavior: 'smooth' });
}

// ===================================
// API設定
// ===================================
function getApiKey() {
    return localStorage.getItem(CONFIG.storageKeys.apiKey);
}

function checkApiKey() {
    if (!getApiKey()) {
        // APIキーがない場合はモーダルを表示
        setTimeout(() => showModal(true), 500);
    }
    updateGenerateButton();
}

function saveApiKey() {
    const apiKey = elements.apiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem(CONFIG.storageKeys.apiKey, apiKey);
        showModal(false);
        updateGenerateButton();
    }
}

function showModal(show) {
    if (show) {
        elements.apiKeyInput.value = getApiKey() || '';
        elements.apiModal.classList.add('active');
    } else {
        elements.apiModal.classList.remove('active');
    }
}

// ===================================
// Service Worker登録
// ===================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// ===================================
// アプリ起動
// ===================================
document.addEventListener('DOMContentLoaded', init);
