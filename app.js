/**
 * 着物バーチャル試着アプリ
 * Gemini APIを使用した顔合成機能
 */

// ===================================
// 設定
// ===================================
const CONFIG = {
    // 着物データ（マネキン画像を使用）
    kimonos: [
        {
            id: 1,
            name: '振袖 1',
            image: 'images/kimono (1).jpg',
            description: 'A vibrant yellow/gold furisode with red accents at the hem. Decorated with colorful peony, chrysanthemum, and cherry blossom patterns in pink, white, red, and turquoise. Purple obi belt with gold embroidery and green decorative cord (obijime).'
        },
        {
            id: 2,
            name: '振袖 2',
            image: 'images/kimono (2).jpg',
            description: 'A deep green and black furisode with purple gradients. Features vibrant floral patterns including red peonies, pink cherry blossoms, and white flowers. Golden-orange obi belt with gold decorative elements and small bag.'
        },
        {
            id: 3,
            name: '振袖 3',
            image: 'images/kimono (3).jpg',
            description: 'An elegant furisode displayed on mannequin with traditional Japanese patterns and colors.'
        },
        {
            id: 4,
            name: '振袖 4',
            image: 'images/kimono (4).jpg',
            description: 'A traditional furisode displayed on mannequin featuring classic Japanese design elements.'
        },
        {
            id: 5,
            name: '振袖 5',
            image: 'images/kimono (5).jpg',
            description: 'A beautiful furisode displayed on mannequin with distinctive patterns and color combinations.'
        },
        {
            id: 6,
            name: '振袖 6',
            image: 'images/kimono (6).JPG',
            description: 'A stunning furisode displayed on mannequin showcasing traditional Japanese craftsmanship.'
        }
    ],

    // Gemini API設定 (自作プロキシサーバー経由)
    apiEndpoint: '/api/generate',

    // ローカルストレージキー
    storageKeys: {
        accessCode: 'kimono_app_access_code'
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
    checkAccessCode();
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
    const canGenerate = state.selectedKimono && state.customerPhoto && getAccessCode();
    elements.generateBtn.disabled = !canGenerate;
}

// ===================================
// 画像生成処理
// ===================================
async function handleGenerate() {
    if (state.isGenerating) return;

    const accessCode = getAccessCode();
    if (!accessCode) {
        showModal(true);
        return;
    }

    state.isGenerating = true;
    showLoading(true);

    try {
        // 着物画像をBase64に変換
        const kimonoBase64 = await imageToBase64(state.selectedKimono.image);

        // 自作プロキシサーバーにリクエスト
        const response = await fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                accessCode: accessCode,
                contents: [{
                    parts: [
                        {
                            text: `あなたは最高峰の画像合成と顔の同一性保持の専門家です。
Image 1（人物のポートレート）と Image 2（マネキン）を元に、最高品質の一枚の写真を生成してください。

【最重要指示：顔の同一性】
- Image 1 の人物の顔の特徴を完全にコピーし、同一人物であることを保証してください。

【着物の再現】
- Image 2 の着物・帯・小物を忠実に再現してください。

【出力】
- 全身のポートレート写真。
- 日本の伝統的な高級スタジオでの撮影。
- 写真のようにリアルで、高精細な画像。`
                        },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: state.customerPhotoBase64
                            }
                        },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: kimonoBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                    imageConfig: {
                        aspectRatio: '2:3',
                        imageSize: '2K'
                    }
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
// ===================================// アクセスコード管理
function getAccessCode() {
    return localStorage.getItem(CONFIG.storageKeys.accessCode);
}

function checkAccessCode() {
    if (!getAccessCode()) {
        setTimeout(() => showModal(true), 500);
    }
    updateGenerateButton();
}

function saveApiKey() {
    const code = elements.apiKeyInput.value.trim();
    if (code) {
        localStorage.setItem(CONFIG.storageKeys.accessCode, code);
        showModal(false);
        updateGenerateButton();
    }
}

function showModal(show) {
    if (show) {
        elements.apiKeyInput.value = getAccessCode() || '';
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
