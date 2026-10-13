// ===== 추가 기능 9: 가족 랭킹 (Firebase Firestore) =====
// 모든 기기의 선수별 최고 점수를 인터넷의 공용 저장소에 모아서 같이 봄
// 저장 구조: scores/{선수이름} = { score: 숫자, updatedAt: 서버 시각 }
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc, onSnapshot, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// 웹에 공개되는 용도의 설정 값 (비밀번호 아님, 실제 권한은 보안 규칙이 결정)
const firebaseConfig = {
  apiKey: 'AIzaSyDXoJL_pCaXGwjiKdS2WzdtUSTJ7tdvcq0',
  authDomain: 'tetris-9ab07.firebaseapp.com',
  projectId: 'tetris-9ab07',
  storageBucket: 'tetris-9ab07.firebasestorage.app',
  messagingSenderId: '648253977208',
  appId: '1:648253977208:web:a2b38c1d88cbd18448738d',
};

const db = getFirestore(initializeApp(firebaseConfig));
const scoresRef = collection(db, 'scores');

// 공용 기록이 바뀔 때마다 자동으로 알려줌 (다른 가족이 기록을 깨면 바로 반영)
onSnapshot(scoresRef, (snapshot) => {
  const remote = {};
  snapshot.forEach((d) => { remote[d.id] = d.data().score; });
  window.onRemoteScores(remote); // tetris.js에 전달
}, (err) => {
  console.warn('랭킹을 불러오지 못했어요:', err.code);
  window.onRankingError();
});

// 최고 기록을 공용 저장소에 올림 (실패해도 게임은 계속, 이 기기에는 남아 있음)
window.submitScore = async (player, score) => {
  try {
    await setDoc(doc(scoresRef, player), { score, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn('기록을 올리지 못했어요:', err.code);
  }
};
