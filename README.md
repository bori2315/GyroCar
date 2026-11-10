# Gyro Car Battle

Node.js + Express + Socket.IO 기반 멀티플레이 프로토타입입니다. Firebase는 사용하지 않습니다.

## Render 배포
1. Render에서 New > Web Service를 선택하고 이 GitHub 저장소를 연결합니다.
2. Runtime: Node
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Deploy 후 Render가 제공하는 HTTPS 주소로 접속합니다.

## 기능
- 6자리 방 코드 생성 및 참가
- 방당 최대 8명
- 방장만 게임 시작 가능
- Socket.IO 실시간 입력 및 플레이어 위치 동기화
- 모바일 DeviceOrientation 권한 요청(iOS 포함)

## 참고
- Render 서비스는 GitHub Pages가 아니라 Render에서 제공하는 주소로 접속해야 합니다. GitHub Pages는 Node.js 서버를 실행하지 않습니다.
- 현재 방 데이터는 서버 메모리에 저장됩니다. 서버 재시작 시 방이 사라지는 테스트용 구조입니다.
- 기본 멀티플레이 프로토타입이며, 충돌/점수/재접속 복구/운영용 보안 및 실제 iOS·Android 기기 테스트는 추가 작업이 필요합니다.
- 서버에 연결되지 않으면 방 생성/참가가 작동하지 않습니다.
