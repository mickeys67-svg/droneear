# DroneEar — 디버깅 & 배포 세션 (2026-06-02)

## 결과 요약
- **빌드 22 / v2.2.1** → App Store Connect 업로드 **완료**(제출 FINISHED, 처리 완료 "완료" 확인됨).
- 남은 것: ASC 웹에서 **빌드 22 첨부 + 릴리스 노트 입력 → 심사에 제출** (수동 단계).
- `tsc` 클린, **테스트 160/160 통과**(탐지 정확도 88.8% 유지).

## 커밋
- `36a2d94` — v2.2.0 대규모 디버깅 18개 안전수정
- `55d1b8f` — v2.2.1 LOG 탭/필터 잘림 수정 + 버전 2.2.0→2.2.1

## 빌드/제출 ID
- Build: `37cd3377-1886-4020-9fdd-149fc636a960` (v2.2.1, build 22, FINISHED)
- 성공한 자동제출: `38e80d41-b067-4857-aaff-9443a4a2eef7` (status FINISHED, error null)
- 이전 build 21(v2.2.0)은 "이미 제출된 버전"이라 거부 → 2.2.1로 올려 해결.

## 이 빌드(2.2.1)에 들어간 수정
**SCAN 떨림 근본수정**
- 진짜 원인 = `MicQualityPanel` 정보 row가 live SNR 폭 변화로 줄바꿈 → 패널 높이 변동 → 아래 전체 위아래로 튕김. row를 한 줄 고정 높이 + numberOfLines + SNR 우측 고정폭으로 잠금.
- 나침반 heading 저역통과(α=0.2)+3° 데드밴드 → 레이더 미세회전 제거(raw는 DOA 보존).

**LOG 화면 잘림**
- 탭 "LOG" 글씨 가로지르던 활성 밑줄을 아이콘 아래로 이동(bottom:-10→0), 탭바 높이 82→88로 라벨 하단 잘림 해소.
- 필터 칩 상단 잘림 = `filterRow` 세로 패딩 추가로 안쪽으로 밀어 해결 + 칩 텍스트 한 줄 고정.

**크래시/기능**
- history 상세 NaN bearing `.toFixed()` 가드
- map DISMISS가 trackId로 동작(이전 detection.id라 매칭 실패)

**다국어 오버플로우 9곳**: ScanButton, ActiveThreatsList, MicPermissionOverlay(스크롤), settings 행+InfoRow, history 배지, TrackingOverlay, map 거리, EnvBanner 버튼, HearingPill

**코어 방어가드(동작변화 없음)**: watchdog `lastFrameTime` 복구후 리셋, Kalman 공분산 클램프(1e6), fusion `lastSeen` 유효성가드, EnvironmentDetector.start() idempotent, `DEVICE_PROFILES` 널가드, settingsStore migrate 기본값 병합

## App Store 텍스트
**프로모션 텍스트(KO)**: 하늘을 청취하세요. DroneEar가 스마트폰 마이크로 드론 음향 패턴을 실시간 식별하고, 전술 레이더에 방향을 표시하며, 모든 분석을 기기 안에서 처리합니다.

**릴리스 노트(KO)**:
- 소리가 들릴 때 청취 화면이 떨리던 현상 수정
- 레이더 나침반 방향 표시 미세 떨림 제거
- 기록(LOG) 화면 탭 글자·필터 칩 잘림 수정
- 여러 언어에서 버튼·라벨 잘림 수정
- 상세 기록 열 때 드문 종료 현상 방지
- 지도 표식 숨기기(DISMISS) 동작 수정
- 전반적 안정성·메모리 개선

> ⚠️ WiFi Remote ID는 **안드로이드 전용** — iOS 스토어 문구에 넣지 말 것. BLE Remote ID/음향 식별/레이더는 iOS도 OK.

## 다음 빌드 백로그 (이번 빌드 미포함)
**TIER C — 백그라운드 복귀 라이프사이클 (코드 반영됨, 빌드 미포함)**
- AppState resume stale 캡처(WiFi/BLE/env/GPS) refs 미러로 수정, env+location 재시작, 배터리 skip rate 복구, startScanning 롤백. → **다음 빌드에서 실기기(백그라운드→포그라운드) 검증 필요.**

**TIER D — 코어 동작변경 (재검증 필수, 즉흥패치 금지)**
- `bleDevices` 무한증가(TTL/캡 없음), AudioClassifier melBuffer trim cadence, MicQualityMonitor 노이즈플로어 최소값 오판(10퍼센타일 권장), 투표 디바운스, Mel 필터뱅크 zero-width(참조 fingerprint 패리티), frameSkip off-by-one, recording stop 알람 정책.

## 남은 수동 단계 (ASC 웹)
1. App Store Connect → DroneEar → App Store 탭 → 버전 2.2.1 (없으면 ⊕로 생성)
2. 빌드 섹션 → 빌드 추가 → **2.2.1 (22)** 첨부
3. 릴리스 노트 입력 → 저장 → **심사에 제출**
   - 기존 메타데이터(설명/키워드/스크린샷/개인정보)는 자동 승계
   - 빠진 필수 항목은 ASC가 빨간 경고로 막아줌
