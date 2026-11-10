# AI_Place / Gyro Car Battle

## GitHub Pages + Firebase 테스트 버전
Node.js / Express / Socket.IO 없이 정적 웹사이트로 실행하는 프로토타입입니다.

### Firebase 설정
1. Firebase Console에서 프로젝트를 만들고 Web App을 추가합니다.
2. Authentication > Sign-in method에서 Anonymous 로그인을 켭니다.
3. Realtime Database를 생성합니다.
4. `firebase-config.js`의 `YOUR_...` 값을 실제 웹 앱 설정으로 바꿉니다.
5. Realtime Database Rules에 `database.rules.json`을 적용합니다.

주의: 현재 규칙은 테스트용입니다. 공개 서비스 전에는 방별 멤버 검증, 호스트 권한, 악용 방지 규칙을 강화해야 합니다. Firebase 웹 설정은 비밀번호가 아니지만 DB 보안 규칙은 반드시 적용해야 합니다.

### GitHub Pages
저장소 Settings > Pages > Deploy from a branch에서 main / root를 선택합니다. 현재 저장소는 private이므로 GitHub Free에서는 Pages 공개 배포가 제한될 수 있습니다. public으로 전환하기 전 저장소 내용을 검토하세요. 저장소 공개 전환은 하지 않았습니다.

### 테스트
PC와 스마트폰에서 같은 HTTPS Pages 주소로 접속하고 방 코드를 공유합니다. 스마트폰은 가로로 돌린 뒤 센서 시작 버튼을 누릅니다. iOS Safari는 권한 허용이 필요하며 Android Chrome도 센서 이벤트 수신 여부를 화면에서 확인합니다.

### 한계
기기별 실제 센서 작동은 iOS/Android 실기기 테스트가 필요합니다. 현재는 기본 방/플레이어 동기화 프로토타입이며 서버 권위 물리, 충돌/점수 판정, 재접속 복구, 강화된 방별 보안은 포함하지 않습니다.
