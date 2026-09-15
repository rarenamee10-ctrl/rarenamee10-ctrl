// Используем глобальный объект из версии 0.11.0
const { createFFmpeg, fetchFile } = FFmpeg;

let ffmpeg = null;
let selectedFile = null;

const statusBadge = document.getElementById('statusBadge');
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const infoBox = document.getElementById('infoBox');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const patchBtn = document.getElementById('patchBtn');
const progressWrap = document.getElementById('progressWrap');
const bar = document.getElementById('bar');
const logText = document.getElementById('logText');
const doneWrap = document.getElementById('doneWrap');
const dlLink = document.getElementById('dlLink');

// Блокируем выбор, пока ядро не готово
uploadBox.style.pointerEvents = 'none';
uploadBox.style.opacity = '0.5';

async function init() {
    try {
        // Инициализация старой, но рабочей версии (без блокировок Safari)
        ffmpeg = createFFmpeg({ 
            log: false,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        
        logText.textContent = 'Скачивание ядра (~25MB)...';
        await ffmpeg.load();

        statusBadge.classList.remove('loading');
        statusBadge.classList.add('ready');
        statusBadge.innerHTML = '<span class="spinner"></span> Ядро готово';

        uploadBox.style.pointerEvents = 'auto';
        uploadBox.style.opacity = '1';
    } catch (e) {
        console.error(e);
        statusBadge.innerHTML = 'Ошибка ядра. Обновите страницу.';
        statusBadge.style.color = '#fe2c55';
    }
}

// Выбор файла
fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    
    if (f.size > 400 * 1024 * 1024) {
        alert("⚠️ Файл больше 400 МБ! Safari на iPhone закроет вкладку из-за нехватки памяти. Выберите видео поменьше.");
        return;
    }

    selectedFile = f;
    fileName.textContent = f.name.length > 22 ? f.name.substring(0,19)+'...' : f.name;
    fileSize.textContent = (f.size / 1024 / 1024).toFixed(1) + ' MB';
    
    infoBox.classList.remove('hidden');
    patchBtn.classList.remove('hidden');
    patchBtn.disabled = false;
    doneWrap.classList.add('hidden');
});

// ПРИМЕНЕНИЕ ПАТЧА
patchBtn.addEventListener('click', async () => {
    if (!selectedFile || !ffmpeg) return;

    patchBtn.disabled = true;
    patchBtn.classList.add('hidden');
    progressWrap.classList.remove('hidden');
    doneWrap.classList.add('hidden');
    bar.style.width = '0%';
    logText.textContent = 'Загрузка в оперативную память...';

    try {
        const inputName = 'input.mp4';
        const outputName = 'output.mp4';

        ffmpeg.FS('writeFile', inputName, await fetchFile(selectedFile));

        // Отслеживание прогресса
        ffmpeg.setProgress(({ ratio }) => {
            const pct = Math.min(Math.round(ratio * 100), 100);
            bar.style.width = `${pct}%`;
            logText.textContent = `Изменение внутреннего кода: ${pct}%`;
        });

        logText.textContent = 'Патчинг структуры (TikTok Anti-Compress)...';

        // === МАГИЯ ПАТЧЕРА ===
        // Видео: Идеальный профиль H.264, 1080x1920, 60fps, битрейт 18M-20M.
        // Аудио: -c:a copy (Вообще не трогаем звук, оставляем оригинал!)
        await ffmpeg.run(
            '-i', inputName,
            '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=60,format=yuv420p',
            '-c:v', 'libx264',
            '-profile:v', 'high',
            '-level', '4.2',
            '-preset', 'ultrafast', 
            '-tune', 'zerolatency',
            '-b:v', '18M',
            '-maxrate', '20M',
            '-bufsize', '40M',
            '-c:a', 'copy',             // <--- ТВОЕ ТРЕБОВАНИЕ: Аудио без изменений
            '-movflags', '+faststart',
            outputName
        );

        logText.textContent = 'Сохранение результата...';
        const data = ffmpeg.FS('readFile', outputName);
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        dlLink.href = url;
        progressWrap.classList.add('hidden');
        doneWrap.classList.remove('hidden');
        
        // Очистка памяти
        ffmpeg.FS('unlink', inputName);
        ffmpeg.FS('unlink', outputName);

    } catch (err) {
        console.error(err);
        logText.textContent = '❌ Краш памяти iPhone. Видео слишком тяжелое для браузера.';
        patchBtn.classList.remove('hidden');
        patchBtn.disabled = false;
    }
});

window.onload = init;
