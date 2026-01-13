// view-tracker.js
// File này xử lý đếm view và theo dõi vị trí IP

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get, runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';  // ← Import config từ file riêng

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const viewsRef = ref(db, 'portfolio/views');

// Hàm lấy vị trí từ IP với 2 API dự phòng
async function getLocationFromIP(ip) {
  // Thử API 1: ip-api.com (45 requests/phút)
  try {
    console.log('🔍 Trying API 1: ip-api.com');
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      console.log('✅ API 1 success:', `${data.city}, ${data.country}`);
      return `${data.city}, ${data.country}`;
    } else {
      throw new Error('API 1 failed: ' + data.message);
    }
  } catch (error) {
    console.warn('⚠️ API 1 failed, trying API 2...', error.message);
    
    // Thử API 2: ipapi.co (1,000 requests/ngày)
    try {
      console.log('🔍 Trying API 2: ipapi.co');
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await response.json();
      
      if (data.city && data.country_name) {
        console.log('✅ API 2 success:', `${data.city}, ${data.country_name}`);
        return `${data.city}, ${data.country_name}`;
      } else {
        throw new Error('API 2 failed: No data');
      }
    } catch (error2) {
      console.error('❌ Both APIs failed:', error2.message);
      return 'Unknown Location';
    }
  }
}

// Hàm theo dõi view
async function trackView() {
  console.log('🔍 Starting trackView...');
  console.log('📊 Firebase Config:', firebaseConfig);
  console.log('🌐 Database URL:', firebaseConfig.databaseURL);
  
  try {
    // Lấy IP hiện tại của người truy cập
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    const currentIP = ipData.ip;
    
    // Chuyển IP sang dạng Firebase key (123.45.67.89 → 123_45_67_89)
    const ipKey = currentIP.replace(/\./g, '_');

    // BƯỚC 1: Kiểm tra xem IP này có phải của chủ không
    const ownerSnapshot = await get(ref(db, `portfolio/ownerIPs/${ipKey}`));
    const isOwner = ownerSnapshot.exists();

    // BƯỚC 2: Kiểm tra xem IP này đã view chưa
    const viewerSnapshot = await get(ref(db, `portfolio/viewers/${ipKey}`));
    const hasViewed = viewerSnapshot.exists();

    // BƯỚC 3: Chỉ tăng view khi không phải IP chủ và chưa từng view
    if (!hasViewed && !isOwner) {
      // Lấy vị trí từ IP
      const location = await getLocationFromIP(currentIP);
      
      // Tăng số view
      await runTransaction(viewsRef, (currentViews) => {
        return (currentViews || 0) + 1;
      });

      // Đánh dấu IP này đã view + LƯU VỊ TRÍ
      await set(ref(db, `portfolio/viewers/${ipKey}`), {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        location: location,
        ip: currentIP
      });

      console.log('✅ View counted for IP:', currentIP, 'Location:', location);
    } else {
      if (isOwner) {
        console.log('🔒 Owner IP detected, view not counted');
      } else {
        console.log('👁️ IP already viewed before');
      }
    }

    // BƯỚC 4: Hiển thị tổng số view
    const snapshot = await get(viewsRef);
    const viewCount = snapshot.val() || 0;
    
    // Kiểm tra xem element có tồn tại không
    const viewCountElement = document.getElementById('visitor-count');
    if (viewCountElement) {
      viewCountElement.innerText = viewCount.toLocaleString();
    }

  } catch (error) {
    console.error('❌ Error tracking view:', error);
    const viewCountElement = document.getElementById('visitor-count');
    if (viewCountElement) {
      viewCountElement.innerText = '---';
    }
  }
}

// Chạy khi trang load
trackView();