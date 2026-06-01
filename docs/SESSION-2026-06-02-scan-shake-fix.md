# DroneEar — SCAN 화면 떨림 수정 + LOG 정리 (2026-06-02)

> 작성일: 2026-06-02 / App Store 제출 예정: **2026-06-03**
> 앱 버전: `2.2.0` (app.json) — 제출 전 buildNumber 증가 필요

---

## 1. 이번 세션에서 고친 것

### A. SCAN 화면 "소리 나면 화면 전체가 위아래로 심하게 떨림" (3회째 재발 → 근본 해결)

**증상**: 소리가 날 때 레이더·거리글씨·배경이 글씨가 안 보일 정도로 위아래로 진동. 조용하면 안 떨림. "Signal Quality" 박스 *아래로* 전부 움직이고, 박스 윗부분은 고정.

**진짜 원인 (지난 3번이 놓친 것)**:
re-render 빈도 문제가 **아니라** **레이아웃 reflow**였다. `MicQualityPanel`("Signal Quality" 박스) 맨 아래에 경고 배지(`{micWarning && ...}`)가 있는데, 소리가 나면 `micWarning`이 매 프레임(20–30Hz) `null↔WIND/NOISE/CLIPPING`으로 튀어 배지(~50px)가 생겼다 사라짐 → 그 아래 전부(레이더 포함)가 30Hz로 밀려 올라갔다 내려옴. re-render는 레이아웃이 안정적이면 화면을 안 움직이므로, "re-render 줄이기"만 한 이전 수정들은 효과가 없었다.

**적용한 2중 방어**:
1. **dwell-히스테리시스** (`src/hooks/useThreatDetector.ts`):
   `quality`/`warning`이 ① 연속 `HYSTERESIS_FRAMES=15`프레임 지속 **그리고** ② 직전 변경 후 `MIN_DWELL_FRAMES=90`프레임(~3–4초) 경과, 둘 다 만족해야 commit. → 배지가 최대 3–4초에 1번만 바뀜. 30Hz 깜빡임이 코드상 불가능. `snrDb`는 실시간 유지(숫자만 변함, 레이아웃 영향 없음). committed 값을 store(배지)와 `sensorMgr`(센서패널) 양쪽에 공급.
2. **패널을 레이더 아래로 이동** (`app/(tabs)/index.tsx`):
   렌더 순서 = `헤더 → 환경배너 → 레이더 → Signal Quality → 센서패널 → 스펙트로그램`. 오디오로 높이가 변할 수 있는 두 패널을 레이더 아래로 옮겨, 레이더 세로 위치는 비(非)오디오 요소(헤더·환경배너)에만 의존 → 설령 ①이 뚫려도 레이더는 안 밀림.

### B. SCAN 부수 수정
- **HEARING 인디케이터 알약**: `maxWidth`→고정 `width:'90%'` + `minHeight`. 텍스트(%·카테고리)가 매 프레임 바뀌어도 좌우로 안 흔들림(표시는 계속 갱신).
- **고빈도 store 구독을 leaf로 격리**: `useThreatDetector`가 단지 return하려고 구독하던 `audioLevel`/`spectralData`/`inferenceTimeMs`/`micQuality·SnrDb·Warning` 제거 → 화면 전체 프레임단위 re-render 제거. 실제 표시는 leaf가 store 직접 구독(`TacticalSpectrogram`, `MicQualityPanel`, `HearingPill`, `DebugRmsItem`, `DebugInferenceItem`, `DebugHeardPanel`).

### C. LOG(History) 화면 — 텍스트 잘림 / 박스 걸림
- 심각도 필터 가로 `ScrollView`에 높이 제약이 없어 칩이 잘리고 투명 비활성 칩 뒤로 빈 상태 텍스트가 비쳤음 → `filterScroll` 스타일에 `height:56` + `flexGrow:0`/`flexShrink:0`로 밴드 고정, 칩 높이 48→40으로 줄여 여백 확보. (`app/(tabs)/history.tsx`)

---

## 2. 변경 파일
- `src/hooks/useThreatDetector.ts` — dwell-히스테리시스, 고빈도 구독 제거
- `app/(tabs)/index.tsx` — 패널 레이더 아래 이동, HEARING 알약 고정폭, 리렌더 격리 leaf 추가
- `src/components/scan/MicQualityPanel.tsx` — store 직접 구독(props optional + fallback)
- `app/(tabs)/history.tsx` — 필터 ScrollView 높이 고정

검증: `npx tsc --noEmit` 통과 (오류 0).
미검증: 이 세션은 Windows 환경이라 iOS 실기기/시뮬레이터 시각 확인 불가. **빌드 후 육안 확인 필요.**

---

## 3. 내일(2026-06-03) 제출 체크리스트

1. [ ] `app.json` buildNumber(iOS)/versionCode(Android) 증가 (EAS autoIncrement면 자동)
2. [ ] EAS 빌드: `eas build -p ios --profile production`
3. [ ] **빌드에서 육안 확인 (가장 중요 — 아래 시나리오)**:
   - [ ] SCAN 시작 후 **소리를 내며**(박수·음악·말소리) 레이더가 **위아래로 안 떨리는지**
   - [ ] "Signal Quality"가 레이더 **아래**에 정상 표시되는지 (위치 변경됨)
   - [ ] HEARING 알약이 좌우로 안 흔들리는지
   - [ ] LOG 탭: 필터 칩(All/MODERATE/WEAK/FAINT) 안 잘리고, 빈 상태 텍스트와 안 겹치는지
4. [ ] TestFlight 업로드 → 심사 제출
5. [ ] (옵션) 떨림이 남으면 `MIN_DWELL_FRAMES` 90→120, `HYSTERESIS_FRAMES` 15→25로 올리면 더 강해짐

---

## 4. 만약 빌드에서도 여전히 떨린다면 (정밀 분리법)
- 조용한 곳에서도 떨리면 → 원인은 mic 아님(나침반/환경배너) → 그쪽 정조준
- "Signal Quality" 경고 배지(💨/🔊/⚠)가 그래도 깜빡이면 → dwell 상수 상향
- 떨리는 게 레이더인지 / 그 아래(스펙트로그램·버튼)인지 한 줄 관찰만 공유하면 정확히 마무리 가능

자세한 근본원인·교훈은 메모리 `feedback_audio_frame_rerender.md` 참고.
