# 🌐 글로벌 랭킹 (Firebase) 설정 가이드

이 게임의 **GLOBAL 탭**은 Firebase Realtime Database를 사용합니다.
설정하지 않으면 LOCAL 랭킹만 동작 (디바이스별 저장).

설정 시간: **약 10분**, 비용: **무료** (Firebase Spark 플랜).

---

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 (Google 계정으로 로그인)
2. **Add project / 프로젝트 추가** 클릭
3. 프로젝트 이름: 예) `neon-hangul-puzzle` (아무거나 OK)
4. **Google Analytics**: 비활성화 (이 게임에는 불필요)
5. **Create project** → 잠시 대기

## 2. Realtime Database 만들기

1. 좌측 메뉴 → **Build** → **Realtime Database**
2. **Create Database** 클릭
3. **Location**: `asia-southeast1` 또는 `asia-northeast` (속도 빠름)
4. **Start in test mode** 선택 (보안 규칙은 다음 단계에서 강화)
5. 생성된 DB의 URL 메모 (예: `https://neon-hangul-puzzle-default-rtdb.firebaseio.com/`)

## 3. 보안 규칙 설정 (어뷰즈 방어)

Realtime Database 페이지 → **Rules** 탭 → 기존 내용을 아래로 교체:

```json
{
  "rules": {
    "rankings": {
      ".read": true,
      "v1": {
        ".read": true,
        ".indexOn": "score",
        "$entry": {
          ".write": "newData.hasChildren(['name','score','ts']) && newData.child('score').isNumber() && newData.child('score').val() <= 1000000 && newData.child('score').val() >= 0 && newData.child('name').isString() && newData.child('name').val().length <= 10",
          ".validate": true
        }
      }
    }
  }
}
```

**Publish** 클릭. 이 규칙은:
- 누구나 읽기 가능 (공개 랭킹)
- 쓰기는 정해진 형식만 허용 (이름 ≤10자, 점수 ≤100만)
- 점수 인덱스 생성으로 빠른 정렬

## 4. Web 앱 등록 + 설정 복사

1. 프로젝트 개요 (홈) → **`</>` 웹 아이콘** 클릭
2. **앱 닉네임**: 예) `web` 입력
3. **Firebase Hosting**: 체크 안 함
4. **Register app** 클릭
5. 다음 화면에 표시되는 객체를 복사:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "neon-hangul-puzzle.firebaseapp.com",
     databaseURL: "https://neon-hangul-puzzle-default-rtdb.firebaseio.com",
     projectId: "neon-hangul-puzzle",
     storageBucket: "neon-hangul-puzzle.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc..."
   };
   ```

## 5. 코드에 붙여넣기

`js/firebase-config.js` 파일을 열어서 `REPLACE_ME` 자리를
방금 복사한 값으로 교체:

```js
window.FIREBASE_CONFIG = {
  apiKey:        "AIza...",
  authDomain:    "neon-hangul-puzzle.firebaseapp.com",
  databaseURL:   "https://neon-hangul-puzzle-default-rtdb.firebaseio.com",
  projectId:     "neon-hangul-puzzle",
  storageBucket: "neon-hangul-puzzle.appspot.com",
  messagingSenderId: "123456789",
  appId:         "1:123456789:web:abc...",
};
```

> **`databaseURL` 필드가 가장 중요합니다.** 빠뜨리지 마세요.

## 6. 푸시 + 배포

```bash
git add js/firebase-config.js
git commit -m "Firebase 설정 추가"
git push
```

GitHub Actions가 1~2분 후 자동 배포합니다. 게임을 새로고침하면
GLOBAL 탭에서 모든 사람의 점수가 보입니다.

---

## 보안 / API Key 노출에 대해

`apiKey` 가 클라이언트 코드에 들어가는 게 걱정될 수 있는데, **Firebase Web API Key는 공개돼도 안전한 식별자**입니다 ([공식 문서](https://firebase.google.com/docs/projects/api-keys#general-info)).

실제 보안은 **Database Rules** (3번 단계)에서 처리합니다.
이 가이드의 규칙은 이름 길이 / 점수 범위 / 필수 필드 검증을 모두 포함합니다.

## 무료 한도 (Spark 플랜)

- 동시 접속: 100명
- 다운로드: 10 GB/월
- 저장: 1 GB

개인 게임에는 충분합니다.

## 데이터 청소 (선택)

랭킹이 너무 많이 쌓이면 Firebase 콘솔 → Realtime Database 에서
직접 삭제하거나, 100개 이상 쌓일 때 자동으로 가장 낮은 점수를
지우는 Cloud Function을 추가할 수 있습니다 (필요 시 안내).
