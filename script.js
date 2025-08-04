// Daftarkan Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered!'))
      .catch(err => console.log('Error:', err));
  });
}

// Variabel global
let currentStep = 1;
let selectedLayout = null;
let selectedCountdown = 3;
let capturedFrames = [];
let videoStream = null;
let deferredPrompt;

// Elemen DOM
const steps = document.querySelectorAll('.step');
const layoutOptions = document.querySelectorAll('.layout-option');
const countdownSelect = document.getElementById('countdownSelect');
const nextBtn1 = document.getElementById('nextBtn1');
const nextBtn2 = document.getElementById('nextBtn2');
const startBtn = document.getElementById('startBtn');
const videoElement = document.getElementById('video');
const countdownDisplay = document.getElementById('countdownDisplay');
const progressBarFill = document.getElementById('progressBarFill');
const stripResult = document.getElementById('stripResult');
const downloadStrip = document.getElementById('downloadStrip');
const flash = document.getElementById('flash');
const newPhotoBtn = document.getElementById('newPhotoBtn');
const bgMusic = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
const musicIcon = document.querySelector('.music-icon');
const muteIcon = document.querySelector('.mute-icon');

// Debugging: Log semua elemen penting
console.log({
  layoutOptions,
  countdownSelect,
  nextBtn1,
  videoElement,
  steps
});

// Set volume dan looping
bgMusic.volume = 0.3;
bgMusic.loop = true;

// Set state awal ikon (musik menyala)
musicIcon.style.display = 'block';
muteIcon.style.display = 'none';

// Handle autoplay policy yang lebih baik
function startMusic() {
  // Coba play musik
  const playPromise = bgMusic.play();
  
  if (playPromise !== undefined) {
    playPromise.then(() => {
      // Berhasil play - tampilkan icon musik
      musicIcon.style.display = 'block';
      muteIcon.style.display = 'none';
    }).catch(error => {
      // Gagal play - tampilkan icon mute
      musicIcon.style.display = 'none';
      muteIcon.style.display = 'block';
      console.log('Autoplay prevented:', error);
    });
  }
}

// Coba play saat pertama load
startMusic();

// Tambahkan fallback untuk mobile - gunakan event listener di container utama
document.querySelector('.app-container').addEventListener('click', function firstInteraction() {
  startMusic();
  document.querySelector('.app-container').removeEventListener('click', firstInteraction);
}, { once: true, passive: true });

// Toggle control yang lebih robust
musicToggle.addEventListener('click', () => {
  if (bgMusic.paused) {
    bgMusic.play().then(() => {
      musicIcon.style.display = 'block';
      muteIcon.style.display = 'none';
    }).catch(err => {
      console.log('Play failed:', err);
    });
  } else {
    bgMusic.pause();
    musicIcon.style.display = 'none';
    muteIcon.style.display = 'block';
  }
});

// PWA Installation
const installBtn = document.createElement('button');
installBtn.id = 'installBtn';
installBtn.className = 'install-button';
installBtn.textContent = 'Install App';
installBtn.style.display = 'none';

document.body.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'block';
  
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User ${outcome} the install prompt`);
    }
  });
});

// Fungsi untuk memastikan font sudah dimuat
async function ensureFontLoaded() {
  const font = new FontFace(
    'CustomFont',
    'url(fonts/Corinthia-Bold.ttf)'
  );
  
  try {
    await font.load();
    document.fonts.add(font);
    console.log('Custom font loaded successfully');
  } catch (err) {
    console.error('Failed to load custom font:', err);
    // Fallback ke font lain jika gagal
    const fallbackFont = new FontFace(
      'Parisienne', 
      'url(https://fonts.gstatic.com/s/parisienne/v8/E21i_d3kivvAkxhLEVZpcy96X4aPgw.ttf)'
    );
    await fallbackFont.load();
    document.fonts.add(fallbackFont);
  }
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM fully loaded and parsed');
  
  // Load font terlebih dahulu
  await ensureFontLoaded();
  
  // Set default countdown
  countdownSelect.value = selectedCountdown;
  
  // Initialize event listeners
  initEventListeners();

  newPhotoBtn.addEventListener('click', () => {
    goToStep(1);
  });

  // Debug: Log status layout options
  console.log('Layout options initialized:', layoutOptions.length);
});

function initEventListeners() {
  console.log('Initializing event listeners...');
  
  // Layout selection dengan debugging
  layoutOptions.forEach(option => {
    console.log('Adding listener for layout:', option.dataset.layout);
    
    option.addEventListener('click', function() {
      console.log('Layout clicked:', this.dataset.layout);
      
      // Hapus class selected dari semua option
      layoutOptions.forEach(opt => {
        opt.classList.remove('selected');
        console.log('Removed selected from:', opt.dataset.layout);
      });
      
      // Tambah class selected ke option yang diklik
      this.classList.add('selected');
      selectedLayout = this.dataset.layout;
      
      console.log('Selected layout:', selectedLayout);
    });

    // Tambahkan event listener untuk keyboard (accessibility)
    option.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        option.click();
      }
    });
  });

  countdownSelect.addEventListener('change', () => {
    selectedCountdown = parseInt(countdownSelect.value);
    console.log('Countdown changed to:', selectedCountdown);
  });

  nextBtn1.addEventListener('click', () => {
    console.log('Next button 1 clicked. Selected layout:', selectedLayout);
    
    if (!selectedLayout) {
      alert('Please select a layout first.');
      return;
    }
    goToStep(2);
  });

  nextBtn2.addEventListener('click', () => {
    console.log('Next button 2 clicked');
    goToStep(3);
  });

  startBtn.addEventListener('click', startPhotoCapture);
}

// Step navigation
function goToStep(stepNumber) {
  console.log(`Navigating to step ${stepNumber}`);
  
  steps[currentStep - 1].classList.remove('active');
  currentStep = stepNumber;
  steps[currentStep - 1].classList.add('active');
  
  if (currentStep === 3) {
    progressBarFill.style.width = '0%';
    // Mulai kamera saat masuk ke step 3
    startCamera().catch(err => {
      console.error('Camera start failed:', err);
      alert('Could not access camera. Please check permissions.');
      goToStep(1); // Kembali ke step 1 jika kamera gagal
    });
  }
}

// Start camera
async function startCamera() {
  console.log('Starting camera...');
  
  try {
    // Hentikan stream jika sudah ada
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }
    
    videoStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user' 
      } 
    });
    
    videoElement.srcObject = videoStream;
    
    return new Promise(resolve => {
      videoElement.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        videoElement.play();
        resolve();
      };
    });
  } catch (error) {
    console.error("Camera error:", error);
    throw error;
  }
}

// Start photo capture process
async function startPhotoCapture() {
  console.log('Starting photo capture with layout:', selectedLayout);
  
  if (!videoStream) {
    try {
      await startCamera();
    } catch (error) {
      return;
    }
  }
  
  try {
    const totalFrames = selectedLayout === '3x1' ? 3 : 4;
    capturedFrames = [];
    console.log(`Capturing ${totalFrames} frames...`);
    
    for (let i = 0; i < totalFrames; i++) {
      console.log(`Capturing frame ${i + 1} of ${totalFrames}`);
      await countdown(selectedCountdown);
      const frameDataUrl = await captureFrame();
      capturedFrames.push(frameDataUrl);
      progressBarFill.style.width = `${((i + 1) / totalFrames) * 100}%`;
    }
    
    await generatePhotoStrip();
    goToStep(4);
    
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
  } catch (error) {
    console.error("Capture error:", error);
    alert("An error occurred during capture. Please try again.");
  }
}

// Capture single frame
function captureFrame() {
  console.log('Capturing frame...');
  
  return new Promise(resolve => {
    // Flash effect
    flash.style.opacity = 0.9;
    setTimeout(() => {
      flash.style.opacity = 0;
    }, 300);

    const canvas = document.createElement('canvas');
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 20);
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Enhance image
    ctx.filter = 'contrast(1.1) brightness(1.05) saturate(1.1)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    
    resolve(canvas.toDataURL('image/jpeg', 0.8));
  });
}

// Countdown timer
function countdown(seconds) {
  console.log(`Starting ${seconds} second countdown`);
  
  return new Promise(resolve => {
    countdownDisplay.textContent = seconds;
    let counter = seconds;
    
    const interval = setInterval(() => {
      counter--;
      countdownDisplay.textContent = counter;
      console.log('Countdown:', counter);
      
      if (counter <= 0) {
        clearInterval(interval);
        countdownDisplay.textContent = 'SMILE!';
        setTimeout(() => {
          countdownDisplay.textContent = '';
          resolve();
        }, 500);
      }
    }, 1000);
  });
}

// Generate photo strip
async function generatePhotoStrip() {
  console.log('Generating photo strip...');
  
  // Pastikan font sudah dimuat
  await ensureFontLoaded();
  
  return new Promise((resolve) => {
    const stripCanvas = document.createElement('canvas');
    const ctx = stripCanvas.getContext('2d');
    const frameCount = capturedFrames.length;
    const imgWidth = 350;
    const imgHeight = Math.round(imgWidth / (videoElement.videoWidth/videoElement.videoHeight));
    
    const padding = 15;
    const margin = 15;
    const textHeight = 40;
    
    stripCanvas.width = imgWidth + (margin * 2);
    stripCanvas.height = (imgHeight * frameCount) + (padding * (frameCount - 1)) + textHeight + 30;
    
    ctx.fillStyle = '#6b5a71ff';
    ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    
    let loadedImages = 0;
    
    capturedFrames.forEach((src, index) => {
      const img = new Image();
      img.src = src;
      img.onload = function() {
        const x = margin;
        const y = margin + (imgHeight + padding) * index;

        ctx.save();
        ctx.translate(x + imgWidth, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
        ctx.restore();
        
        loadedImages++;
        console.log(`Loaded image ${loadedImages} of ${frameCount}`);
        
        if (loadedImages === frameCount) {
          // Gunakan font yang sudah dimuat
          ctx.fillStyle = '#000000ff';
          ctx.font = 'bold 28px "CustomFont", cursive, Parisienne';
          ctx.textAlign = 'center';
          ctx.fillText(
            "Agneesha's Birthday", 
            stripCanvas.width / 2, 
            stripCanvas.height - 20
          );
          
          const stripUrl = stripCanvas.toDataURL('image/png');
          stripResult.src = stripUrl;
          downloadStrip.href = stripUrl;
          console.log('Photo strip generated');
          resolve();
        }
      };
    });
  });
}