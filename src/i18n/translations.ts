/**
 * Internationalization (i18n) System
 *
 * Supports: Korean (ko), English (en), Ukrainian (uk),
 *           Arabic (ar), Hebrew (he), Hindi (hi),
 *           Urdu (ur), Tagalog (tl), Gulf Arabic (ar_gulf),
 *           German (de), Spanish (es), French (fr), Italian (it),
 *           Chinese Simplified (zh), Japanese (ja)
 *
 * RTL languages: Arabic, Hebrew, Urdu, Gulf Arabic
 */

export type SupportedLocale =
  | 'ko' | 'en' | 'uk'
  | 'ar' | 'he' | 'hi' | 'ur' | 'tl' | 'ar_gulf'
  | 'de' | 'es' | 'fr' | 'it'
  | 'zh' | 'ja';

/** Languages that use Right-to-Left text direction */
export const RTL_LOCALES: SupportedLocale[] = ['ar', 'he', 'ur', 'ar_gulf'];

export interface Translations {
  // App
  appName: string;

  // Main Screen
  scanning: string;
  standby: string;
  loading: string;
  error: string;
  sensorOffline: string;
  scanningTracks: (count: number) => string;
  engageSensors: string;
  haltDetection: string;
  tapToBegin: string;
  initializingEngine: string;

  // Permissions
  sensorAccessDenied: string;
  micPermissionRequired: string;
  openSettings: string;
  grantAccess: string;

  // Signal Levels
  criticalThreat: string;
  highThreat: string;
  mediumThreat: string;
  lowThreat: string;
  clear: string;
  acknowledge: string;
  type: string;
  confidence: string;
  distance: string;
  bearing: string;
  approach: string;
  estimatedDistance: string;
  directionLimited: string;

  // Acoustic Pattern Categories
  droneSmall: string;
  droneLarge: string;
  helicopter: string;
  missile: string;
  aircraft: string;
  ambient: string;

  // Confidence Levels
  veryHighConfidence: string;
  highConfidence: string;
  moderateConfidence: string;
  lowConfidence: string;
  verificationNeeded: string;

  // History
  detectionLog: string;
  clearAll: string;
  clearConfirmTitle: string;
  clearConfirmMsg: (count: number) => string;
  cancel: string;
  noDetections: string;
  startScanningHint: string;
  total: string;
  todaysDetections: string;
  thisWeek: string;
  avgConfidence: string;

  // Settings
  settings: string;
  displayTheme: string;
  acousticProfile: string;
  detection: string;
  hapticAlert: string;
  vibrateOnDetection: string;
  audioAlert: string;
  playWarningSound: string;
  voiceAlert: string;
  voiceAnnouncement: string;
  debugMode: string;
  showInferenceMetrics: string;
  confidenceThreshold: string;
  mlModel: string;
  language: string;

  // Theme Options
  dayMode: string;
  dayModeDesc: string;
  nightMode: string;
  nightModeDesc: string;
  amoledMode: string;
  amoledModeDesc: string;

  // Voice Alerts (TTS)
  voiceWarning: string;
  voiceCritical: string;
  voiceDetected: (category: string, distance: number, direction: string) => string;
  voiceApproaching: (speed: number) => string;
  voiceScanStarted: string;
  voiceScanStopped: string;
  voiceNoThreats: string;
  voiceTracking: (count: number) => string;

  // Mic Quality
  micQualityGood: string;
  micQualityFair: string;
  micQualityPoor: string;
  micWindWarning: string;
  micNoiseWarning: string;
  micClippingWarning: string;
  micWindHint?: string;
  micNoiseHint?: string;
  micClippingHint?: string;
  signalQuality: string;

  // Accuracy Disclaimers
  distanceDisclaimer: string;
  bearingDirection?: string;
  bearingDisclaimer: string;
  accuracyNote: string;
  mlDisclaimer: string;
  acousticDisclaimer: string;
  similarDrones: string;

  // Onboarding
  onboardingWelcome: string;
  onboardingWelcomeDesc: string;
  onboardingMic: string;
  onboardingMicDesc: string;
  onboardingProfile: string;
  onboardingProfileDesc: string;
  onboardingTest: string;
  onboardingTestDesc: string;
  onboardingReady: string;
  onboardingReadyDesc: string;
  next: string;
  skip: string;
  getStarted: string;
  testMicrophone: string;
  micTestGood: string;
  micTestBad: string;

  // Guide / Help
  guideTitle: string;
  guideRadarTitle: string;
  guideRadarDesc: string;
  guideSpecTitle: string;
  guideSpecDesc: string;
  guideAlertTitle: string;
  guideAlertDesc: string;
  guideTipsTitle: string;
  guideTip1: string;
  guideTip2: string;
  guideTip3: string;
  guideTip4: string;
  guideProfilesTitle: string;
  guideLimitsTitle: string;
  guideLimitsDesc: string;

  // Detection Range Guide
  guideRangeTitle: string;
  guideRangeDesc: string;
  guideRangeMultirotor: string;
  guideRangeSingleEngine: string;
  guideRangeSingleRotor: string;
  guideRangeJet: string;
  guideRangeFixedWing: string;
  guideRangeNote: string;

  // Feedback
  wasDetectionAccurate: string;
  yes: string;
  no: string;
  reportFalsePositive: string;
  thankYouFeedback: string;

  // Battery
  battery: string;

  // Mic Enforcement (persistent alarm)
  micOffAlarmTitle: string;
  micOffAlarmDesc: string;
  micOffAlarmVoice: string;
  enableMicNow: string;

  // Indoor/Outdoor Detection Guidance
  indoorWarningTitle: string;
  indoorWarningDesc: string;
  indoorWarningVoice: string;
  outdoorRecommendTitle: string;
  outdoorRecommendDesc: string;
  optimalPositionTitle: string;
  optimalPositionDesc: string;
  moveOutdoors: string;
  positionTips: string;

  // Accuracy Degraded → Shelter → Move to Detection Position flow
  accuracyDegradedTitle: string;
  accuracyDegradedDesc: string;
  accuracyDegradedVoice: string;
  shelterCheckTitle: string;
  shelterCheckDesc: string;
  shelterCheckVoice: string;
  moveToDetectionTitle: string;
  moveToDetectionDesc: string;
  moveToDetectionVoice: string;
  detectionCapability: string;
  stepShelter: string;
  stepMoveOutdoor: string;
  stepPositionMic: string;
  currentAccuracy: string;
  environmentIndoor: string;
  environmentOutdoor: string;
  environmentUncertain: string;

  // Directions
  north: string;
  northEast: string;
  east: string;
  southEast: string;
  south: string;
  southWest: string;
  west: string;
  northWest: string;

  // Onboarding BLE
  onboardingBLE: string;
  onboardingBLEDesc: string;
  onboardingBLESkip: string;

  // Export
  exportData: string;
  exportCSV: string;
  exportJSON: string;
  exportSuccess: string;
  exportError?: string;
  all?: string;

  // BLE Remote ID
  bleScan: string;
  bleScanDesc: string;
  wifiScan?: string;
  wifiScanDesc?: string;
  bleEnabled: string;
  bleDisabled: string;
  bleUnavailable: string;
  bleRemoteID: string;
  bleDeviceFound: string;
  bleSerialNumber: string;
  bleOperatorLocation: string;
  bleNoDevices: string;
  bleWifiNotice?: string;
  bleWifiNoticeDesc?: string;
  bleWifiAndroidOnly?: string;
  audioDetectionNote?: string;
  audioDetectionDesc?: string;
  androidWifiSupported?: string;

  // Map Screen
  mapTab: string;
  mapTitle: string;
  mapNoLocation: string;
  mapAcousticRadius: string;
  mapFusedDetection: string;
  mapBLEDevice: string;
  mapOperator: string;
  mapAltitude: string;
  mapSpeed: string;
  mapHeading: string;
  mapSerial: string;
  mapNoDetections: string;

  // Phase 0 UI additions
  micPermissionDenied: string;
  micPermissionGranted: string;
  micPermissionBlockedDesc: string;
  tryAgain: string;
  continueWithout: string;
  track: string;
  dismiss: string;
  frequency: string;
  detectionDetails: string;
  acousticSignature: string;
  viewOnMap: string;

  // Error Boundary
  systemError?: string;
  unexpectedError?: string;
  restart?: string;

  // Tab Navigation
  tabScan?: string;
  tabMap?: string;
  tabLog?: string;
  tabSet?: string;
  tabGuide?: string;
  tabScanDesc?: string;
  tabMapDesc?: string;
  tabLogDesc?: string;

  // Map
  active?: string;
  close?: string;

  // Settings sections
  appearance?: string;
  aboutSection?: string;
  profileSection?: string;
  modelLabel?: string;
  quantizationLabel?: string;
  classesLabel?: string;
  patternsCount?: string;
  resetOnboarding?: string;
  resetOnboardingMsg?: string;
  ok?: string;
  privacyPolicy?: string;
  batteryWarning?: string;
  batteryHalf?: string;
  batteryLow?: string;
  batteryCritical?: string;

  // History
  historyTab?: string;
  noFilterResults?: string;
  meters?: string;

  // Tracking overlay
  tracking?: string;
  closeTracking?: string;

  // Index screen extras
  permissionBlocked?: string;
  micAccessRequired?: string;
  howToEnable?: string;
  permStep1?: string;
  permStep2?: string;
  permStep3?: string;
  loadingAcousticModel?: string;
  engineError?: string;
  engineErrorDesc?: string;
  retry?: string;
  stereo?: string;
  similarModels?: string;
  loadingDefault?: string;

  // Onboarding extra
  welcome?: string;
  acousticDroneDetection?: string;
  stepOf?: (step: number, total: number) => string;
  allow?: string;
  selectDevice?: string;
  continueBtn?: string;
  speakOrMakeSound?: string;
  listeningTest?: string;
  detectControllersDesc?: string;
  enableBLE?: string;
  startScanningBtn?: string;
}

const ko: Translations = {
  appName: 'DRONEEAR',

  // Main
  scanning: '청취 중',
  standby: '대기',
  loading: '로딩',
  error: '오류',
  sensorOffline: '센서 오프라인',
  scanningTracks: (count) => `청취 중 • ${count}개 트랙`,
  engageSensors: '청취 시작',
  haltDetection: '청취 중지',
  tapToBegin: '탭하여 음향 청취 시작',
  initializingEngine: '음향 추론 엔진 초기화 중...',

  // Permissions
  sensorAccessDenied: '센서 접근 거부됨',
  micPermissionRequired: '음향 모니터링을 위해 마이크 권한이 필요합니다. 기기 설정에서 접근을 허용해 주세요.',
  openSettings: '설정 열기',
  grantAccess: '권한 허용',

  // Signal Levels
  criticalThreat: '강한 신호',
  highThreat: '보통 신호',
  mediumThreat: '약한 신호',
  lowThreat: '미약한 신호',
  clear: '안전',
  acknowledge: '확인',
  type: '유형',
  confidence: '신뢰도',
  distance: '거리',
  bearing: '방위',
  approach: '접근',
  estimatedDistance: '추정 거리',
  directionLimited: '방향 추정 제한적',

  // Acoustic Pattern Categories
  droneSmall: '멀티로터',
  droneLarge: '단일엔진 추진체',
  helicopter: '싱글로터',
  missile: '제트/터빈 추진체',
  aircraft: '프로펠러 고정익',
  ambient: '배경음',

  // Confidence
  veryHighConfidence: '매우 높은 확신',
  highConfidence: '높은 확신',
  moderateConfidence: '보통 확신',
  lowConfidence: '낮은 확신',
  verificationNeeded: '추가 확인 필요',

  // History
  detectionLog: '식별 기록',
  clearAll: '전체 삭제',
  clearConfirmTitle: '식별 기록 삭제',
  clearConfirmMsg: (count) => `${count}개의 식별 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.`,
  cancel: '취소',
  noDetections: '이 세션에 기록된 식별 없음.',
  startScanningHint: '청취를 시작하여 드론을 식별하세요.',
  total: '전체',
  todaysDetections: '오늘',
  thisWeek: '이번 주',
  avgConfidence: '평균 신뢰도',

  // Settings
  settings: '설정',
  displayTheme: '화면 테마',
  acousticProfile: '음향 프로파일',
  detection: '식별',
  hapticAlert: '진동 알림',
  vibrateOnDetection: '식별 시 진동',
  audioAlert: '경고음',
  playWarningSound: '경고 사운드 재생',
  voiceAlert: '음성 안내',
  voiceAnnouncement: '패턴 식별 시 음성 알림',
  debugMode: '디버그 모드',
  showInferenceMetrics: '추론 지표 표시',
  confidenceThreshold: '신뢰도 임계값',
  mlModel: 'ML 모델',
  language: '언어',

  // Theme
  dayMode: '주간 모드',
  dayModeDesc: '높은 대비. 일반 사용.',
  nightMode: '야간 모드',
  nightModeDesc: '적색 표시. 어두운 환경 최적화.',
  amoledMode: 'AMOLED 절전',
  amoledModeDesc: '완전 블랙. 최대 배터리 절약.',

  // Voice
  voiceWarning: '경고',
  voiceCritical: '긴급',
  voiceDetected: (cat, dist, dir) => `${cat} 패턴 식별. 거리 약 ${dist}미터. 방향 ${dir}.`,
  voiceApproaching: (speed) => `접근 중. 초속 ${speed}미터.`,
  voiceScanStarted: '음향 청취를 시작합니다.',
  voiceScanStopped: '청취를 중지했습니다.',
  voiceNoThreats: '현재 식별된 패턴이 없습니다.',
  voiceTracking: (count) => `${count}개 패턴 추적 중.`,

  // Mic Quality
  micQualityGood: '양호',
  micQualityFair: '보통',
  micQualityPoor: '불량',
  micWindWarning: '바람 소음이 감지됩니다. 마이크를 차단해 주세요.',
  micNoiseWarning: '주변 소음이 높습니다. 조용한 환경으로 이동해 주세요.',
  micClippingWarning: '오디오 클리핑 감지. 게인을 낮춰 주세요.',
  micWindHint: '마이크를 바람으로부터 차단하세요',
  micNoiseHint: '조용한 장소로 이동하세요',
  micClippingHint: '소음원에서 멀리 이동하세요',
  signalQuality: '신호 품질',

  // Accuracy
  distanceDisclaimer: '거리는 음압 기반 추정값이며 환경에 따라 오차가 있을 수 있습니다.',
  bearingDirection: '방향 추정',
  bearingDisclaimer: '방향 추정은 단일 마이크에서 제한적입니다. 스테레오 프로파일 사용을 권장합니다.',
  accuracyNote: '식별 결과는 참고용이며, 실제 상황과 다를 수 있습니다.',
  mlDisclaimer: '이 앱은 음향 패턴 추정 기반이며, 모든 드론을 식별하지 못할 수 있습니다. 오탐/미탐 가능성이 있습니다.',
  acousticDisclaimer: '음향 특성 기반 추정이며, 실제 기체와 다를 수 있습니다.',
  similarDrones: '유사 드론',

  // Onboarding
  onboardingWelcome: 'DroneEar에 오신 것을 환영합니다',
  onboardingWelcomeDesc: '스마트폰 마이크로 음향 패턴을 분석하여 주변 드론의 유형을 추정하는 앱입니다.',
  onboardingMic: '마이크 접근 허용',
  onboardingMicDesc: '드론의 프로펠러 소리를 분석하기 위해 마이크 접근이 필요합니다. 모든 오디오는 기기에서만 처리되며 외부로 전송되지 않습니다.',
  onboardingProfile: '기기 프로파일 선택',
  onboardingProfileDesc: '최적의 식별 성능을 위해 기기에 맞는 오디오 프로파일을 선택하세요.',
  onboardingTest: '마이크 테스트',
  onboardingTestDesc: '주변 소음 수준을 측정하여 마이크가 정상 작동하는지 확인합니다.',
  onboardingReady: '준비 완료!',
  onboardingReadyDesc: '청취 시작 버튼을 눌러 음향 모니터링을 시작하세요. 가능한 조용한 야외 환경에서 사용하면 가장 정확합니다.',
  next: '다음',
  skip: '건너뛰기',
  getStarted: '시작하기',
  testMicrophone: '마이크 테스트',
  micTestGood: '마이크 정상 작동 중!',
  micTestBad: '마이크 감도가 낮습니다. 기기 설정을 확인하세요.',

  // Guide
  guideTitle: '사용 가이드',
  guideRadarTitle: '방향 표시기',
  guideRadarDesc: '중심점은 사용자 위치입니다. 동심원은 거리를 나타냅니다 (500m, 1000m, 1500m, 2000m). 색상이 있는 점은 식별된 신호이며, 빨강=강함, 주황=보통, 파랑=약함입니다.',
  guideSpecTitle: '음향 스펙트럼',
  guideSpecDesc: '실시간 주파수 분석입니다. 초록색 막대는 정상, 노란색은 주의, 빨간색은 드론 의심 주파수입니다. 막대가 높을수록 해당 주파수의 소리가 강합니다.',
  guideAlertTitle: '드론 알림',
  guideAlertDesc: '드론이 식별되면 알림 패널이 나타납니다. 유형, 신뢰도, 추정 거리, 방향이 표시됩니다. 확인을 눌러 닫으세요.',
  guideTipsTitle: '최적 사용 팁',
  guideTip1: '조용한 야외 환경에서 사용하면 식별 정확도가 높아집니다.',
  guideTip2: '마이크를 하늘 방향으로 향하게 하면 더 효과적입니다.',
  guideTip3: '바람이 강한 날에는 마이크를 손이나 천으로 차단해 주세요.',
  guideTip4: '고감도 모드는 조용한 환경에서, 표준 모드는 일반 환경에서 사용하세요.',
  guideProfilesTitle: '프로파일 안내',
  guideLimitsTitle: '식별 한계',
  guideLimitsDesc: '이 앱은 음향 기반 식별이므로 다음과 같은 한계가 있습니다:\n• 무소음 드론은 식별 불가\n• 거리 추정은 환경에 따라 오차 발생\n• 방향 추정은 단일 마이크에서 제한적\n• 강한 바람/소음은 정확도 저하 원인\n• 모든 드론 유형을 식별하지 못할 수 있음',

  // Detection Range
  guideRangeTitle: '📡 음향 패턴별 추정 청취 거리',
  guideRangeDesc: '스마트폰 마이크 기반 추정 거리입니다. 환경(바람, 소음, 고도)에 따라 크게 달라질 수 있습니다.',
  guideRangeMultirotor: '멀티로터 (소형 드론): 50~200m',
  guideRangeSingleEngine: '단일엔진 추진체 (대형 드론): 200~500m',
  guideRangeSingleRotor: '싱글로터 (헬기형): 500m~1.5km',
  guideRangeJet: '제트/터빈 추진체: 1~2.5km',
  guideRangeFixedWing: '프로펠러 고정익: 150~400m',
  guideRangeNote: '※ 조용한 야외 환경 기준이며, 실제 거리는 음원 크기·대기 조건·주변 소음에 따라 달라집니다. 3km 이상은 스마트폰 마이크의 물리적 한계로 감지가 불가능합니다.',

  // Feedback
  wasDetectionAccurate: '이 식별이 정확했나요?',
  yes: '예',
  no: '아니오',
  reportFalsePositive: '오탐 보고',
  thankYouFeedback: '피드백 감사합니다!',

  // Battery
  battery: '배터리',

  // Mic Enforcement
  micOffAlarmTitle: '⚠ 마이크가 꺼져 있습니다',
  micOffAlarmDesc: '음향 모니터링이 불가능합니다. 마이크를 활성화해야 청취가 시작됩니다.',
  micOffAlarmVoice: '경고. 마이크가 꺼져 있습니다. 마이크를 켜주세요. 마이크 없이는 음향 모니터링을 할 수 없습니다.',
  enableMicNow: '마이크 켜기',

  // Indoor/Outdoor
  indoorWarningTitle: '⚠ 실내 환경 감지됨',
  indoorWarningDesc: '실내에서는 음향 모니터링이 제한됩니다. 벽과 천장이 드론 프로펠러 소리를 차단합니다. 야외로 이동해 주세요.',
  indoorWarningVoice: '경고. 실내 환경이 감지되었습니다. 실내에서는 음향 모니터링이 제한됩니다. 야외 개활지로 이동해 주세요.',
  outdoorRecommendTitle: '최적 청취 위치 안내',
  outdoorRecommendDesc: '정확도를 높이려면 야외 개활지에서 사용하세요.',
  optimalPositionTitle: '📍 최적 위치 안내',
  optimalPositionDesc: '• 건물에서 50m 이상 떨어진 개활지\n• 도로/차량 소음이 적은 곳\n• 바람이 약한 곳 (바람막이 가능)\n• 마이크를 하늘 방향으로 향하게\n• 높은 지대일수록 청취 범위 증가',
  moveOutdoors: '야외로 이동',
  positionTips: '위치 안내',

  // Accuracy Degraded → Shelter → Detection Position
  accuracyDegradedTitle: '⚠ 청취 정확도 저하',
  accuracyDegradedDesc: '현재 환경에서 음향 모니터링 정확도가 낮습니다. 더 나은 정확도를 위해 야외로 이동하세요.',
  accuracyDegradedVoice: '경고. 청취 정확도가 낮습니다. 더 나은 정확도를 위해 야외 개활지로 이동하세요.',
  shelterCheckTitle: '1단계: 환경 확인',
  shelterCheckDesc: '현재 환경을 확인하세요.\n• 실내인 경우 야외로 이동 권장\n• 주변 소음 수준 확인\n• 확인 후 다음 단계로 이동',
  shelterCheckVoice: '1단계. 현재 환경을 확인하세요. 실내인 경우 야외로 이동하면 더 정확한 결과를 얻을 수 있습니다.',
  moveToDetectionTitle: '2단계: 청취 위치로 이동',
  moveToDetectionDesc: '환경 확인 후 야외 개활지로 이동하세요.\n• 건물에서 50m 이상 떨어진 곳\n• 높은 지대 권장 (청취 범위 증가)\n• 마이크를 하늘 방향으로\n• 바람막이 준비',
  moveToDetectionVoice: '2단계. 야외 개활지로 이동하세요. 건물에서 50미터 이상 떨어진 높은 지대가 가장 좋습니다.',
  detectionCapability: '청취 가능 수준',
  stepShelter: '환경 확인',
  stepMoveOutdoor: '청취 위치 이동',
  stepPositionMic: '마이크 위치 조정',
  currentAccuracy: '현재 정확도',
  environmentIndoor: '실내',
  environmentOutdoor: '야외',
  environmentUncertain: '판별 중',

  // Directions
  north: '북',
  northEast: '북동',
  east: '동',
  southEast: '남동',
  south: '남',
  southWest: '남서',
  west: '서',
  northWest: '북서',

  // Onboarding BLE
  onboardingBLE: 'Bluetooth 드론 감지',
  onboardingBLEDesc: 'BLE Remote ID 스캔을 통해 근처 드론의 원격 식별 신호를 수신할 수 있습니다. Bluetooth 권한이 필요합니다.',
  onboardingBLESkip: 'Bluetooth 없이 계속',

  // Export
  exportData: '데이터 내보내기',
  exportCSV: 'CSV로 내보내기',
  exportJSON: 'JSON으로 내보내기',
  exportSuccess: '내보내기 완료!',
  exportError: '내보내기 오류',
  all: '전체',

  // BLE Remote ID
  bleScan: 'BLE 원격 ID 스캔',
  bleScanDesc: 'Bluetooth로 드론 원격 식별 신호를 스캔합니다',
  wifiScan: 'WiFi Remote ID',
  wifiScanDesc: 'WiFi로 드론 Remote ID를 스캔합니다 (Android 전용)',
  bleEnabled: 'BLE 스캔 활성화',
  bleDisabled: 'BLE 스캔 비활성화',
  bleUnavailable: 'Bluetooth를 사용할 수 없습니다',
  bleRemoteID: '원격 ID',
  bleDeviceFound: 'BLE 드론 발견',
  bleSerialNumber: '시리얼 번호',
  bleOperatorLocation: '운영자 위치',
  bleNoDevices: '발견된 BLE 기기 없음',
  bleWifiNotice: 'DJI, Skydio 등 주요 드론은 WiFi로 Remote ID를 송출합니다. WiFi Remote ID 수신은 Android에서만 가능합니다.',
  bleWifiNoticeDesc: 'iOS에서는 Apple 정책으로 WiFi 스캔이 차단됩니다. 블루투스(BLE) Remote ID만 수신 가능합니다.',
  bleWifiAndroidOnly: 'WiFi Remote ID: Android 전용',
  audioDetectionNote: '음향 + BLE 이중 탐지',
  audioDetectionDesc: 'DroneEar는 음향 분석과 BLE Remote ID 스캔을 동시에 사용하여 최대 탐지 정확도를 제공합니다.',
  androidWifiSupported: '이 기기에서 WiFi Remote ID 수신 가능',

  // Map
  mapTab: '지도',
  mapTitle: '드론 지도',
  mapNoLocation: '위치 정보를 사용할 수 없습니다',
  mapAcousticRadius: '음향 감지 반경',
  mapFusedDetection: '융합 감지',
  mapBLEDevice: 'BLE 기기',
  mapOperator: '운영자',
  mapAltitude: '고도',
  mapSpeed: '속도',
  mapHeading: '방향',
  mapSerial: '시리얼',
  mapNoDetections: '감지된 드론 없음',

  // Phase 0 UI additions
  micPermissionDenied: '마이크 접근이 필요합니다. 마이크 없이는 앱이 작동할 수 없습니다.',
  micPermissionGranted: '✓ 마이크 접근 허용됨',
  micPermissionBlockedDesc: 'DroneEar는 마이크를 사용하여 드론 음향 패턴을 감지합니다. 마이크 접근 없이는 앱이 작동할 수 없습니다.',
  tryAgain: '다시 시도',
  continueWithout: '마이크 없이 계속',
  track: '추적',
  dismiss: '무시',
  frequency: '주파수',
  detectionDetails: '감지 상세',
  acousticSignature: '음향 패턴',
  viewOnMap: '지도에서 보기',

  // Error Boundary
  systemError: '시스템 오류',
  unexpectedError: '예기치 않은 오류가 발생했습니다.',
  restart: '재시작',

  // Tab Navigation
  tabScan: '청취',
  tabMap: '지도',
  tabLog: '기록',
  tabSet: '설정',
  tabGuide: '가이드',
  tabScanDesc: '드론 음향 청취 화면',
  tabMapDesc: '드론 지도 화면',
  tabLogDesc: '식별 기록',

  // Map
  active: '활성',
  close: '닫기',

  // Settings sections
  appearance: '외관',
  aboutSection: '정보',
  profileSection: '프로파일',
  modelLabel: '모델',
  quantizationLabel: '양자화',
  classesLabel: '클래스',
  patternsCount: '6개 패턴',
  resetOnboarding: '온보딩 초기화',
  resetOnboardingMsg: '설정 과정을 다시 시작합니다. 계속하시겠습니까?',
  ok: '확인',
  privacyPolicy: '개인정보 처리방침',
  batteryWarning: '배터리 부족',
  batteryHalf: '배터리가 50% 이하입니다. 장시간 스캔을 위해 보조배터리 연결을 권장합니다.',
  batteryLow: '배터리가 30% 이하입니다. 보조배터리 또는 전원을 연결하세요.',
  batteryCritical: '배터리가 매우 부족합니다. 즉시 전원을 연결하세요.',

  // History
  historyTab: '기록',
  noFilterResults: '해당 심각도의 식별 기록이 없습니다',
  meters: '미터',

  // Tracking overlay
  tracking: '추적 중',
  closeTracking: '추적 닫기',

  // Index screen extras
  permissionBlocked: '권한 차단됨',
  micAccessRequired: '마이크 접근\n필요',
  howToEnable: '활성화 방법:',
  permStep1: '1. 설정 열기',
  permStep2: '2. DroneEar 찾기',
  permStep3: '3. 마이크 활성화',
  loadingAcousticModel: '음향 분석 모델 로딩 중...',
  engineError: '엔진 오류',
  engineErrorDesc: '오디오 분석 엔진 초기화에 실패했습니다. 마이크 권한을 확인하고 다시 시도하세요.',
  retry: '재시도',
  stereo: '스테레오',
  similarModels: '유사 모델',
  loadingDefault: '로딩 중...',

  // Onboarding extra
  welcome: '환영합니다',
  acousticDroneDetection: '음향 드론 감지',
  stepOf: (step, total) => `${total}단계 중 ${step}단계`,
  allow: '계속',
  selectDevice: '기기 선택',
  continueBtn: '계속',
  speakOrMakeSound: '말하거나 소리를 내세요',
  listeningTest: '듣는 중...',
  detectControllersDesc: '근처 드론 원격 조종기를 감지합니다',
  enableBLE: '계속',
  startScanningBtn: '청취 시작',
};

const en: Translations = {
  appName: 'DRONEEAR',

  scanning: 'LISTENING',
  standby: 'STANDBY',
  loading: 'LOADING',
  error: 'ERROR',
  sensorOffline: 'SENSOR OFFLINE',
  scanningTracks: (count) => `LISTENING • ${count} TRACK${count !== 1 ? 'S' : ''}`,
  engageSensors: 'START LISTENING',
  haltDetection: 'STOP LISTENING',
  tapToBegin: 'Tap to begin acoustic monitoring',
  initializingEngine: 'Initializing acoustic inference engine...',

  sensorAccessDenied: 'SENSOR ACCESS DENIED',
  micPermissionRequired: 'Microphone permission is required for acoustic monitoring. Grant access in device settings.',
  openSettings: 'Open Settings',
  grantAccess: 'Grant Access',

  criticalThreat: 'STRONG SIGNAL',
  highThreat: 'MODERATE SIGNAL',
  mediumThreat: 'WEAK SIGNAL',
  lowThreat: 'FAINT SIGNAL',
  clear: 'CLEAR',
  acknowledge: 'ACKNOWLEDGE',
  type: 'TYPE',
  confidence: 'CONFIDENCE',
  distance: 'DISTANCE',
  bearing: 'BEARING',
  approach: 'APPROACH',
  estimatedDistance: 'Est. Distance',
  directionLimited: 'Direction limited',

  droneSmall: 'MULTIROTOR',
  droneLarge: 'SINGLE ENGINE',
  helicopter: 'SINGLE ROTOR',
  missile: 'JET PROPULSION',
  aircraft: 'PROPELLER FIXED-WING',
  ambient: 'BACKGROUND',

  veryHighConfidence: 'Very High',
  highConfidence: 'High',
  moderateConfidence: 'Moderate',
  lowConfidence: 'Low',
  verificationNeeded: 'Needs Verification',

  detectionLog: 'IDENTIFICATION LOG',
  clearAll: 'CLEAR',
  clearConfirmTitle: 'Clear Identification Log',
  clearConfirmMsg: (count) => `Delete all ${count} identification records? This cannot be undone.`,
  cancel: 'Cancel',
  noDetections: 'No identifications recorded in this session.',
  startScanningHint: 'Start listening to identify drones.',
  total: 'TOTAL',
  todaysDetections: 'Today',
  thisWeek: 'This Week',
  avgConfidence: 'Avg Conf.',

  settings: 'SETTINGS',
  displayTheme: 'DISPLAY THEME',
  acousticProfile: 'ACOUSTIC PROFILE',
  detection: 'IDENTIFICATION',
  hapticAlert: 'Haptic Alert',
  vibrateOnDetection: 'Vibrate on identification',
  audioAlert: 'Audio Alert',
  playWarningSound: 'Play warning sound',
  voiceAlert: 'Voice Alert',
  voiceAnnouncement: 'Voice announcement on identification',
  debugMode: 'Debug Mode',
  showInferenceMetrics: 'Show inference metrics',
  confidenceThreshold: 'CONFIDENCE THRESHOLD',
  mlModel: 'ML MODEL',
  language: 'LANGUAGE',

  dayMode: 'DAY MODE',
  dayModeDesc: 'High contrast dark. Standard use.',
  nightMode: 'NIGHT MODE',
  nightModeDesc: 'Red-on-black. Low-light optimized.',
  amoledMode: 'AMOLED SAVE',
  amoledModeDesc: 'Pure black. Maximum battery saving.',

  voiceWarning: 'Warning',
  voiceCritical: 'Critical',
  voiceDetected: (cat, dist, dir) => `${cat} pattern identified. Distance approximately ${dist} meters. Direction ${dir}.`,
  voiceApproaching: (speed) => `Approaching at ${speed} meters per second.`,
  voiceScanStarted: 'Acoustic listening started.',
  voiceScanStopped: 'Listening stopped.',
  voiceNoThreats: 'No patterns identified.',
  voiceTracking: (count) => `Tracking ${count} pattern${count !== 1 ? 's' : ''}.`,

  micQualityGood: 'Good',
  micQualityFair: 'Fair',
  micQualityPoor: 'Poor',
  micWindWarning: 'Wind noise detected. Shield the microphone.',
  micNoiseWarning: 'High ambient noise. Move to a quieter area.',
  micClippingWarning: 'Audio clipping detected. Reduce gain.',
  micWindHint: 'Shield microphone from wind',
  micNoiseHint: 'Move to a quieter location',
  micClippingHint: 'Move away from loud sound source',
  signalQuality: 'Signal Quality',

  distanceDisclaimer: 'Distance is estimated from sound pressure and may vary with environment.',
  bearingDirection: 'Bearing',
  bearingDisclaimer: 'Direction estimation is limited with a single microphone. Use stereo profile for better accuracy.',
  accuracyNote: 'Identification results are for reference only and may differ from actual conditions.',
  mlDisclaimer: 'This app uses acoustic pattern estimation and may not identify all drones. False positives or negatives are possible.',
  acousticDisclaimer: 'Estimated based on acoustic characteristics. Actual aircraft may differ.',
  similarDrones: 'Similar Drones',

  onboardingWelcome: 'Welcome to DroneEar',
  onboardingWelcomeDesc: 'Analyze acoustic patterns to estimate drone types nearby using your smartphone microphone.',
  onboardingMic: 'Microphone Access',
  onboardingMicDesc: 'Microphone access is needed to analyze drone propeller sounds. All audio is processed on-device and never transmitted.',
  onboardingProfile: 'Select Device Profile',
  onboardingProfileDesc: 'Choose the audio profile that matches your device for optimal identification.',
  onboardingTest: 'Microphone Test',
  onboardingTestDesc: 'Measure ambient noise level to verify your microphone is working properly.',
  onboardingReady: 'Ready!',
  onboardingReadyDesc: 'Press START LISTENING to begin acoustic monitoring. Best results in quiet outdoor environments.',
  next: 'Next',
  skip: 'Skip',
  getStarted: 'Get Started',
  testMicrophone: 'Test Microphone',
  micTestGood: 'Microphone working!',
  micTestBad: 'Low microphone sensitivity. Check device settings.',

  guideTitle: 'User Guide',
  guideRadarTitle: 'Direction Indicator',
  guideRadarDesc: 'The center point is your position. Concentric rings show distance (500m, 1000m, 1500m, 2000m). Colored dots are identified signals: red=strong, orange=moderate, blue=weak.',
  guideSpecTitle: 'Acoustic Spectrum',
  guideSpecDesc: 'Real-time frequency analysis. Green bars are normal, yellow means caution, red indicates suspected drone frequencies. Taller bars mean louder sounds at that frequency.',
  guideAlertTitle: 'Drone Alerts',
  guideAlertDesc: 'When a drone is identified, an alert panel appears showing type, confidence, estimated distance, and direction. Press ACKNOWLEDGE to dismiss.',
  guideTipsTitle: 'Best Practices',
  guideTip1: 'Use in quiet outdoor environments for best accuracy.',
  guideTip2: 'Point the microphone skyward for better identification.',
  guideTip3: 'Shield the microphone from wind with your hand or cloth.',
  guideTip4: 'Use High Sensitivity in quiet areas, Balanced in noisy environments.',
  guideProfilesTitle: 'Profile Guide',
  guideLimitsTitle: 'Identification Limitations',
  guideLimitsDesc: 'This app uses acoustic identification with these limitations:\n• Silent drones cannot be identified\n• Distance estimates vary with environment\n• Direction estimation limited with single mic\n• Strong wind/noise reduces accuracy\n• Not all drone types may be identified',

  // Detection Range
  guideRangeTitle: '📡 Estimated Listening Range by Pattern',
  guideRangeDesc: 'Estimated range based on smartphone microphone. Actual range varies significantly with environment (wind, noise, altitude).',
  guideRangeMultirotor: 'Multirotor (small drone): 50~200m',
  guideRangeSingleEngine: 'Single Engine (large drone): 200~500m',
  guideRangeSingleRotor: 'Single Rotor (helicopter type): 500m~1.5km',
  guideRangeJet: 'Jet/Turbine Propulsion: 1~2.5km',
  guideRangeFixedWing: 'Propeller Fixed-Wing: 150~400m',
  guideRangeNote: '※ Based on quiet outdoor conditions. Actual range depends on sound source volume, atmospheric conditions, and ambient noise. Detection beyond 3km is physically impossible with smartphone microphones.',

  wasDetectionAccurate: 'Was this identification accurate?',
  yes: 'Yes',
  no: 'No',
  reportFalsePositive: 'Report False Positive',
  thankYouFeedback: 'Thank you for your feedback!',

  battery: 'Battery',

  micOffAlarmTitle: '⚠ MICROPHONE IS OFF',
  micOffAlarmDesc: 'Acoustic monitoring is not possible. Enable microphone to start listening.',
  micOffAlarmVoice: 'Warning. Microphone is off. Please enable the microphone. Acoustic monitoring is not possible without microphone access.',
  enableMicNow: 'Enable Mic',

  indoorWarningTitle: '⚠ INDOOR ENVIRONMENT DETECTED',
  indoorWarningDesc: 'Acoustic monitoring is limited indoors. Walls and ceilings block propeller sound. Move to an open outdoor area.',
  indoorWarningVoice: 'Warning. Indoor environment detected. Acoustic monitoring is limited indoors. Please move to an open outdoor area.',
  outdoorRecommendTitle: 'Optimal Listening Location',
  outdoorRecommendDesc: 'Use in an open outdoor area for best accuracy.',
  optimalPositionTitle: '📍 Optimal Position Guide',
  optimalPositionDesc: '• Open area 50m+ from buildings\n• Away from road/vehicle noise\n• Low wind area (use windscreen)\n• Point microphone toward sky\n• Higher elevation = wider listening range',
  moveOutdoors: 'Move Outdoors',
  positionTips: 'Position Guide',

  accuracyDegradedTitle: '⚠ LISTENING ACCURACY LOW',
  accuracyDegradedDesc: 'Acoustic monitoring accuracy is low in current environment. For better accuracy, move outdoors.',
  accuracyDegradedVoice: 'Warning. Listening accuracy is low. For better accuracy, move to an open outdoor area.',
  shelterCheckTitle: 'Step 1: Check Environment',
  shelterCheckDesc: 'Check your current environment.\n• If indoors, moving outdoors is recommended\n• Check ambient noise levels\n• Once confirmed, proceed to next step',
  shelterCheckVoice: 'Step 1. Check your current environment. Moving outdoors will provide more accurate results.',
  moveToDetectionTitle: 'Step 2: Move to Listening Position',
  moveToDetectionDesc: 'After checking environment, move to an open outdoor area.\n• 50m+ from buildings\n• Higher elevation recommended\n• Point microphone skyward\n• Prepare wind protection',
  moveToDetectionVoice: 'Step 2. Move to an open outdoor area. Higher elevation at least 50 meters from buildings is ideal.',
  detectionCapability: 'Listening Capability',
  stepShelter: 'Check Environment',
  stepMoveOutdoor: 'Move to Position',
  stepPositionMic: 'Position Microphone',
  currentAccuracy: 'Current Accuracy',
  environmentIndoor: 'Indoor',
  environmentOutdoor: 'Outdoor',
  environmentUncertain: 'Analyzing',

  north: 'N',
  northEast: 'NE',
  east: 'E',
  southEast: 'SE',
  south: 'S',
  southWest: 'SW',
  west: 'W',
  northWest: 'NW',

  // Onboarding BLE
  onboardingBLE: 'Bluetooth Drone Detection',
  onboardingBLEDesc: 'Enable BLE Remote ID scanning to receive drone identification signals nearby. Bluetooth permission is required.',
  onboardingBLESkip: 'Continue without Bluetooth',

  // Export
  exportData: 'Export Data',
  exportCSV: 'Export as CSV',
  exportJSON: 'Export as JSON',
  exportSuccess: 'Export complete!',
  exportError: 'Export Error',
  all: 'All',

  // BLE Remote ID
  bleScan: 'BLE Remote ID Scan',
  bleScanDesc: 'Scan for drone Remote ID signals via Bluetooth',
  wifiScan: 'WiFi Remote ID',
  wifiScanDesc: 'Scan for drone Remote ID via WiFi (Android only)',
  bleEnabled: 'BLE Scan Enabled',
  bleDisabled: 'BLE Scan Disabled',
  bleUnavailable: 'Bluetooth Unavailable',
  bleRemoteID: 'Remote ID',
  bleDeviceFound: 'BLE Drone Found',
  bleSerialNumber: 'Serial Number',
  bleOperatorLocation: 'Operator Location',
  bleNoDevices: 'No BLE Devices Found',
  bleWifiNotice: 'Major drones (DJI, Skydio, etc.) broadcast Remote ID via WiFi. WiFi Remote ID reception is available on Android only.',
  bleWifiNoticeDesc: 'On iOS, WiFi scanning is blocked by Apple policy. Only Bluetooth (BLE) Remote ID can be received.',
  bleWifiAndroidOnly: 'WiFi Remote ID: Android only',
  audioDetectionNote: 'Audio + BLE Dual Detection',
  audioDetectionDesc: 'DroneEar detects drones using acoustic sound analysis alongside BLE Remote ID scanning for maximum detection accuracy.',
  androidWifiSupported: 'WiFi Remote ID supported on this device',

  // Map
  mapTab: 'MAP',
  mapTitle: 'Drone Map',
  mapNoLocation: 'Location unavailable',
  mapAcousticRadius: 'Acoustic detection radius',
  mapFusedDetection: 'Fused Detection',
  mapBLEDevice: 'BLE Device',
  mapOperator: 'Operator',
  mapAltitude: 'Altitude',
  mapSpeed: 'Speed',
  mapHeading: 'Heading',
  mapSerial: 'Serial',
  mapNoDetections: 'No drones detected',

  // Phase 0 UI additions
  micPermissionDenied: 'Microphone access is required for drone detection. Without it, the app cannot function.',
  micPermissionGranted: '✓ Microphone access granted',
  micPermissionBlockedDesc: 'DroneEar uses your microphone to detect drone acoustic signatures. The app cannot function without microphone access.',
  tryAgain: 'TRY AGAIN',
  continueWithout: 'Continue without microphone',
  track: 'TRACK',
  dismiss: 'DISMISS',
  frequency: 'Frequency',
  detectionDetails: 'Detection Details',
  acousticSignature: 'Acoustic Signature',
  viewOnMap: 'VIEW ON MAP',

  // Error Boundary
  systemError: 'System Error',
  unexpectedError: 'An unexpected error occurred.',
  restart: 'RESTART',

  // Tab Navigation
  tabScan: 'SCAN',
  tabMap: 'MAP',
  tabLog: 'LOG',
  tabSet: 'SET',
  tabGuide: 'GUIDE',
  tabScanDesc: 'Drone scan screen',
  tabMapDesc: 'Drone map view',
  tabLogDesc: 'Detection history log',

  // Map
  active: 'ACTIVE',
  close: 'Close',

  // Settings sections
  appearance: 'APPEARANCE',
  aboutSection: 'ABOUT',
  profileSection: 'PROFILE',
  modelLabel: 'Model',
  quantizationLabel: 'Quantization',
  classesLabel: 'Classes',
  patternsCount: '6 patterns',
  resetOnboarding: 'Reset Onboarding',
  resetOnboardingMsg: 'This will restart the setup process. Continue?',
  ok: 'OK',
  privacyPolicy: 'Privacy Policy',
  batteryWarning: 'Low Battery',
  batteryHalf: 'Battery below 50%. Consider connecting a power bank for extended scanning.',
  batteryLow: 'Battery below 30%. Connect a power bank or charger to continue scanning.',
  batteryCritical: 'Battery critically low. Connect power immediately.',

  // History
  historyTab: 'HISTORY',
  noFilterResults: 'No detections for this filter',
  meters: 'meters',

  // Tracking overlay
  tracking: 'TRACKING',
  closeTracking: 'Close tracking',

  // Index screen extras
  permissionBlocked: 'Permission Blocked',
  micAccessRequired: 'Microphone Access\nRequired',
  howToEnable: 'How to enable:',
  permStep1: '1. Open Settings',
  permStep2: '2. Find DroneEar',
  permStep3: '3. Enable Microphone',
  loadingAcousticModel: 'Loading acoustic analysis model...',
  engineError: 'Engine Error',
  engineErrorDesc: 'Audio analysis engine failed to initialize. Check microphone permissions and try again.',
  retry: 'RETRY',
  stereo: 'STEREO',
  similarModels: 'SIMILAR MODELS',
  loadingDefault: 'Loading...',

  // Onboarding extra
  welcome: 'Welcome',
  acousticDroneDetection: 'Acoustic Drone Detection',
  stepOf: (step, total) => `Step ${step} of ${total}`,
  allow: 'CONTINUE',
  selectDevice: 'Select Device',
  continueBtn: 'CONTINUE',
  speakOrMakeSound: 'Speak or make a sound',
  listeningTest: 'LISTENING...',
  detectControllersDesc: 'Detect drone remote controllers nearby',
  enableBLE: 'CONTINUE',
  startScanningBtn: 'START SCANNING',
};

const uk: Translations = {
  appName: 'DRONEEAR',

  scanning: 'ПРОСЛУХУВАННЯ',
  standby: 'ОЧІКУВАННЯ',
  loading: 'ЗАВАНТАЖЕННЯ',
  error: 'ПОМИЛКА',
  sensorOffline: 'СЕНСОР ВИМКНЕНО',
  scanningTracks: (count) => `ПРОСЛУХУВАННЯ • ${count} ЦІЛЬ`,
  engageSensors: 'ПОЧАТИ ПРОСЛУХУВАННЯ',
  haltDetection: 'ЗУПИНИТИ ПРОСЛУХУВАННЯ',
  tapToBegin: 'Натисніть для початку акустичного моніторингу',
  initializingEngine: 'Ініціалізація акустичного аналізу...',

  sensorAccessDenied: 'ДОСТУП ДО СЕНСОРА ЗАБОРОНЕНО',
  micPermissionRequired: 'Для акустичного моніторингу потрібен доступ до мікрофона. Надайте доступ у налаштуваннях.',
  openSettings: 'Налаштування',
  grantAccess: 'Надати доступ',

  criticalThreat: 'СИЛЬНИЙ СИГНАЛ',
  highThreat: 'ПОМІРНИЙ СИГНАЛ',
  mediumThreat: 'СЛАБКИЙ СИГНАЛ',
  lowThreat: 'ЛЕДЬ ПОМІТНИЙ СИГНАЛ',
  clear: 'ЧИСТО',
  acknowledge: 'ПІДТВЕРДИТИ',
  type: 'ТИП',
  confidence: 'ВПЕВНЕНІСТЬ',
  distance: 'ВІДСТАНЬ',
  bearing: 'НАПРЯМОК',
  approach: 'НАБЛИЖЕННЯ',
  estimatedDistance: 'Приблизна відстань',
  directionLimited: 'Напрямок обмежений',

  droneSmall: 'МУЛЬТИРОТОР',
  droneLarge: 'ОДНОМОТОРНИЙ',
  helicopter: 'ОДИНАРНИЙ РОТОР',
  missile: 'РЕАКТИВНИЙ',
  aircraft: 'ГВИНТОВИЙ ЛІТАК',
  ambient: 'ФОНОВИЙ ШУМ',

  veryHighConfidence: 'Дуже висока',
  highConfidence: 'Висока',
  moderateConfidence: 'Середня',
  lowConfidence: 'Низька',
  verificationNeeded: 'Потребує перевірки',

  detectionLog: 'ЖУРНАЛ ІДЕНТИФІКАЦІЙ',
  clearAll: 'ОЧИСТИТИ',
  clearConfirmTitle: 'Очистити журнал ідентифікацій',
  clearConfirmMsg: (count) => `Видалити всі ${count} записів? Це неможливо скасувати.`,
  cancel: 'Скасувати',
  noDetections: 'Немає записів ідентифікацій.',
  startScanningHint: 'Почніть прослухування для ідентифікації дронів.',
  total: 'ВСЬОГО',
  todaysDetections: 'Сьогодні',
  thisWeek: 'Цей тиждень',
  avgConfidence: 'Сер. довіра',

  settings: 'НАЛАШТУВАННЯ',
  displayTheme: 'ТЕМА ДИСПЛЕЯ',
  acousticProfile: 'АКУСТИЧНИЙ ПРОФІЛЬ',
  detection: 'ІДЕНТИФІКАЦІЯ',
  hapticAlert: 'Вібрація',
  vibrateOnDetection: 'Вібрувати при ідентифікації',
  audioAlert: 'Звуковий сигнал',
  playWarningSound: 'Відтворювати попередження',
  voiceAlert: 'Голосове сповіщення',
  voiceAnnouncement: 'Голосове оповіщення при ідентифікації',
  debugMode: 'Режим налагодження',
  showInferenceMetrics: 'Показати метрики',
  confidenceThreshold: 'ПОРІГ ВПЕВНЕНОСТІ',
  mlModel: 'ML МОДЕЛЬ',
  language: 'МОВА',

  dayMode: 'ДЕННИЙ РЕЖИМ',
  dayModeDesc: 'Високий контраст. Стандартне використання.',
  nightMode: 'НІЧНИЙ РЕЖИМ',
  nightModeDesc: 'Червоний на чорному. Оптимізовано для темряви.',
  amoledMode: 'AMOLED РЕЖИМ',
  amoledModeDesc: 'Чисто чорний. Максимальна економія батареї.',

  voiceWarning: 'Увага',
  voiceCritical: 'Критично',
  voiceDetected: (cat, dist, dir) => `${cat} патерн ідентифіковано. Відстань приблизно ${dist} метрів. Напрямок ${dir}.`,
  voiceApproaching: (speed) => `Наближається зі швидкістю ${speed} метрів на секунду.`,
  voiceScanStarted: 'Акустичне прослухування розпочато.',
  voiceScanStopped: 'Прослухування зупинено.',
  voiceNoThreats: 'Патернів не ідентифіковано.',
  voiceTracking: (count) => `Відстеження ${count} патернів.`,

  micQualityGood: 'Добре',
  micQualityFair: 'Задовільно',
  micQualityPoor: 'Погано',
  micWindWarning: 'Виявлено шум вітру. Захистіть мікрофон.',
  micNoiseWarning: 'Високий рівень шуму. Перемістіться в тихіше місце.',
  micClippingWarning: 'Виявлено кліпінг. Зменшіть підсилення.',
  micWindHint: 'Захистіть мікрофон від вітру',
  micNoiseHint: 'Перейдіть до тихішого місця',
  micClippingHint: 'Відійдіть від джерела гучного звуку',
  signalQuality: 'Якість сигналу',

  distanceDisclaimer: 'Відстань оцінюється за звуковим тиском і може відрізнятися залежно від середовища.',
  bearingDirection: 'Напрямок',
  bearingDisclaimer: 'Визначення напрямку обмежене одним мікрофоном. Використовуйте стерео профіль.',
  accuracyNote: 'Результати ідентифікації є орієнтовними і можуть відрізнятися від реальних умов.',
  mlDisclaimer: 'Додаток базується на оцінці акустичних патернів і може не ідентифікувати всі дрони. Можливі хибні спрацювання.',
  acousticDisclaimer: 'Оцінка на основі акустичних характеристик. Фактичний літальний апарат може відрізнятися.',
  similarDrones: 'Схожі дрони',

  onboardingWelcome: 'Ласкаво просимо до DroneEar',
  onboardingWelcomeDesc: 'Аналіз акустичних патернів для оцінки типів дронів поблизу за допомогою мікрофона смартфона.',
  onboardingMic: 'Доступ до мікрофона',
  onboardingMicDesc: 'Потрібен доступ до мікрофона для аналізу звуку пропелерів дронів. Аудіо обробляється тільки на пристрої.',
  onboardingProfile: 'Виберіть профіль пристрою',
  onboardingProfileDesc: 'Оберіть аудіо профіль для оптимальної ідентифікації.',
  onboardingTest: 'Тест мікрофона',
  onboardingTestDesc: 'Вимірювання рівня шуму для перевірки роботи мікрофона.',
  onboardingReady: 'Готово!',
  onboardingReadyDesc: 'Натисніть ПОЧАТИ ПРОСЛУХУВАННЯ для початку. Найкращі результати в тихому середовищі.',
  next: 'Далі',
  skip: 'Пропустити',
  getStarted: 'Почати',
  testMicrophone: 'Тест мікрофона',
  micTestGood: 'Мікрофон працює!',
  micTestBad: 'Низька чутливість мікрофона.',

  guideTitle: 'Посібник',
  guideRadarTitle: 'Індикатор напрямку',
  guideRadarDesc: 'Центр — ваша позиція. Кільця показують відстань (500м, 1000м, 1500м, 2000м). Кольорові точки — ідентифіковані сигнали: червоний=сильний, помаранчевий=помірний, синій=слабкий.',
  guideSpecTitle: 'Акустичний спектр',
  guideSpecDesc: 'Аналіз частот у реальному часі. Зелені стовпці — норма, жовті — увага, червоні — підозра на дрон.',
  guideAlertTitle: 'Сповіщення про дрон',
  guideAlertDesc: 'При ідентифікації дрона зʼявляється панель з типом, впевненістю, відстанню та напрямком. Натисніть ПІДТВЕРДИТИ.',
  guideTipsTitle: 'Поради',
  guideTip1: 'Найкраще працює в тихому відкритому середовищі.',
  guideTip2: 'Спрямуйте мікрофон вгору для кращої ідентифікації.',
  guideTip3: 'Захистіть мікрофон від вітру рукою або тканиною.',
  guideTip4: 'Високу чутливість — в тихих місцях, збалансований — у шумних.',
  guideProfilesTitle: 'Профілі',
  guideLimitsTitle: 'Обмеження ідентифікації',
  guideLimitsDesc: 'Обмеження акустичної ідентифікації:\n• Безшумні дрони не ідентифікуються\n• Оцінка відстані залежить від середовища\n• Напрямок обмежений з одним мікрофоном\n• Вітер/шум знижують точність\n• Не всі типи дронів можуть бути ідентифіковані',

  // Detection Range
  guideRangeTitle: '📡 Орієнтовна дальність прослухування за типом',
  guideRangeDesc: 'Орієнтовна дальність на основі мікрофона смартфона. Фактична дальність значно залежить від середовища (вітер, шум, висота).',
  guideRangeMultirotor: 'Мультиротор (малий дрон): 50~200м',
  guideRangeSingleEngine: 'Одномоторний (великий дрон): 200~500м',
  guideRangeSingleRotor: 'Одинарний ротор (гелікоптер): 500м~1.5км',
  guideRangeJet: 'Реактивний/турбінний: 1~2.5км',
  guideRangeFixedWing: 'Гвинтовий літак: 150~400м',
  guideRangeNote: '※ На основі тихого відкритого простору. Фактична дальність залежить від гучності джерела, атмосферних умов та фонового шуму. Виявлення понад 3км фізично неможливе мікрофоном смартфона.',

  wasDetectionAccurate: 'Ця ідентифікація була точною?',
  yes: 'Так',
  no: 'Ні',
  reportFalsePositive: 'Повідомити про помилку',
  thankYouFeedback: 'Дякуємо за відгук!',

  battery: 'Батарея',

  micOffAlarmTitle: '⚠ МІКРОФОН ВИМКНЕНО',
  micOffAlarmDesc: 'Акустичний моніторинг неможливий. Увімкніть мікрофон для початку прослухування.',
  micOffAlarmVoice: 'Увага. Мікрофон вимкнено. Будь ласка, увімкніть мікрофон. Без мікрофону акустичний моніторинг неможливий.',
  enableMicNow: 'Увімкнути мікрофон',

  indoorWarningTitle: '⚠ ВИЯВЛЕНО ЗАКРИТЕ ПРИМІЩЕННЯ',
  indoorWarningDesc: 'Акустичний моніторинг обмежений у приміщенні. Стіни та стеля блокують звук. Вийдіть на відкритий простір.',
  indoorWarningVoice: 'Увага. Виявлено закрите приміщення. Акустичний моніторинг обмежений у приміщенні. Перемістіться на відкритий простір.',
  outdoorRecommendTitle: 'Оптимальне місце для прослухування',
  outdoorRecommendDesc: 'Використовуйте на відкритому просторі для кращої точності.',
  optimalPositionTitle: '📍 Оптимальна позиція',
  optimalPositionDesc: '• Відкрита місцевість 50м+ від будівель\n• Подалі від шуму доріг\n• Місце з мінімальним вітром\n• Мікрофон спрямований вгору\n• Вище розташування = більший радіус прослухування',
  moveOutdoors: 'Вийти назовні',
  positionTips: 'Поради щодо позиції',

  accuracyDegradedTitle: '⚠ ТОЧНІСТЬ ПРОСЛУХУВАННЯ НИЗЬКА',
  accuracyDegradedDesc: 'Точність акустичного моніторингу низька. Для кращої точності перемістіться на відкритий простір.',
  accuracyDegradedVoice: 'Увага. Точність прослухування низька. Для кращої точності перемістіться на відкритий простір.',
  shelterCheckTitle: 'Крок 1: Перевірка середовища',
  shelterCheckDesc: 'Перевірте поточне середовище.\n• Якщо в приміщенні — рекомендується вийти назовні\n• Перевірте рівень шуму\n• Після підтвердження — наступний крок',
  shelterCheckVoice: 'Крок 1. Перевірте поточне середовище. Вихід на відкритий простір забезпечить точніші результати.',
  moveToDetectionTitle: 'Крок 2: Перемістіться на позицію прослухування',
  moveToDetectionDesc: 'Після перевірки середовища вийдіть на відкритий простір.\n• 50м+ від будівель\n• Рекомендується підвищення\n• Мікрофон вгору\n• Захист від вітру',
  moveToDetectionVoice: 'Крок 2. Перемістіться на відкритий простір. Ідеально — підвищення на відстані 50 метрів від будівель.',
  detectionCapability: 'Можливість прослухування',
  stepShelter: 'Перевірка середовища',
  stepMoveOutdoor: 'Переміщення на позицію',
  stepPositionMic: 'Налаштування мікрофона',
  currentAccuracy: 'Поточна точність',
  environmentIndoor: 'Приміщення',
  environmentOutdoor: 'Відкритий простір',
  environmentUncertain: 'Аналіз',

  north: 'Пн',
  northEast: 'ПнСх',
  east: 'Сх',
  southEast: 'ПдСх',
  south: 'Пд',
  southWest: 'ПдЗх',
  west: 'Зх',
  northWest: 'ПнЗх',

  // Onboarding BLE
  onboardingBLE: 'Bluetooth виявлення дронів',
  onboardingBLEDesc: 'Увімкніть BLE Remote ID для отримання сигналів ідентифікації дронів поблизу. Потрібен дозвіл Bluetooth.',
  onboardingBLESkip: 'Продовжити без Bluetooth',

  // Export
  exportData: 'Експорт даних',
  exportCSV: 'Експорт CSV',
  exportJSON: 'Експорт JSON',
  exportSuccess: 'Експорт завершено!',
  exportError: 'Помилка експорту',
  all: 'Усі',

  // BLE Remote ID
  bleScan: 'BLE сканування Remote ID',
  bleScanDesc: 'Сканування сигналів Remote ID дронів через Bluetooth',
  wifiScan: 'WiFi Remote ID',
  wifiScanDesc: 'Сканування Remote ID дронів через WiFi (лише Android)',
  bleEnabled: 'BLE сканування увімкнено',
  bleDisabled: 'BLE сканування вимкнено',
  bleUnavailable: 'Bluetooth недоступний',
  bleRemoteID: 'Remote ID',
  bleDeviceFound: 'BLE дрон знайдено',
  bleSerialNumber: 'Серійний номер',
  bleOperatorLocation: 'Місце оператора',
  bleNoDevices: 'BLE пристрої не знайдено',
  bleWifiNotice: 'Основні дрони (DJI, Skydio тощо) транслюють Remote ID через WiFi. Прийом WiFi Remote ID доступний лише на Android.',
  bleWifiNoticeDesc: 'На iOS сканування WiFi заблоковано політикою Apple. Приймається лише Bluetooth (BLE) Remote ID.',
  bleWifiAndroidOnly: 'WiFi Remote ID: лише Android',
  audioDetectionNote: 'Аудіо + BLE подвійне виявлення',
  audioDetectionDesc: 'DroneEar виявляє дрони за допомогою акустичного аналізу звуку та BLE Remote ID для максимальної точності.',
  androidWifiSupported: 'WiFi Remote ID підтримується на цьому пристрої',

  // Map
  mapTab: 'КАРТА',
  mapTitle: 'Карта дронів',
  mapNoLocation: 'Місцезнаходження недоступне',
  mapAcousticRadius: 'Радіус акустичного виявлення',
  mapFusedDetection: 'Об\'єднане виявлення',
  mapBLEDevice: 'BLE пристрій',
  mapOperator: 'Оператор',
  mapAltitude: 'Висота',
  mapSpeed: 'Швидкість',
  mapHeading: 'Напрямок',
  mapSerial: 'Серійний №',
  mapNoDetections: 'Дронів не виявлено',

  // Phase 0 UI additions
  micPermissionDenied: 'Для виявлення дронів потрібен доступ до мікрофона. Без нього додаток не може працювати.',
  micPermissionGranted: '✓ Доступ до мікрофона надано',
  micPermissionBlockedDesc: 'DroneEar використовує мікрофон для виявлення акустичних сигнатур дронів. Додаток не може працювати без доступу до мікрофона.',
  tryAgain: 'СПРОБУВАТИ ЗНОВУ',
  continueWithout: 'Продовжити без мікрофона',
  track: 'СТЕЖИТИ',
  dismiss: 'ВІДХИЛИТИ',
  frequency: 'Частота',
  detectionDetails: 'Деталі виявлення',
  acousticSignature: 'Акустична сигнатура',
  viewOnMap: 'ПЕРЕГЛЯНУТИ НА КАРТІ',

  // Error Boundary
  systemError: 'Системна помилка',
  unexpectedError: 'Виникла непередбачена помилка.',
  restart: 'ПЕРЕЗАПУСТИТИ',

  // Tab Navigation
  tabScan: 'СКАН',
  tabMap: 'КАРТА',
  tabLog: 'ЖУРНАЛ',
  tabSet: 'НАЛАШТ',
  tabGuide: 'ДОВІДКА',
  tabScanDesc: 'Екран сканування дронів',
  tabMapDesc: 'Перегляд карти дронів',
  tabLogDesc: 'Журнал ідентифікацій',

  // Map
  active: 'АКТИВНИЙ',
  close: 'Закрити',

  // Settings sections
  appearance: 'ЗОВНІШНІЙ ВИГЛЯД',
  aboutSection: 'ПРО ДОДАТОК',
  profileSection: 'ПРОФІЛЬ',
  modelLabel: 'Модель',
  quantizationLabel: 'Квантизація',
  classesLabel: 'Класи',
  patternsCount: '6 патернів',
  resetOnboarding: 'Скинути вступний курс',
  resetOnboardingMsg: 'Це перезапустить процес налаштування. Продовжити?',
  ok: 'OK',
  privacyPolicy: 'Політика конфіденційності',
  batteryWarning: 'Низький заряд',
  batteryHalf: 'Заряд батареї нижче 50%. Рекомендуємо підключити павербанк для тривалого сканування.',
  batteryLow: 'Заряд батареї нижче 30%. Підключіть павербанк або зарядний пристрій.',
  batteryCritical: 'Критично низький заряд. Негайно підключіть живлення.',

  // History
  historyTab: 'ІСТОРІЯ',
  noFilterResults: 'Немає виявлень для цього фільтра',
  meters: 'метрів',

  // Tracking overlay
  tracking: 'СТЕЖЕННЯ',
  closeTracking: 'Закрити стеження',

  // Index screen extras
  permissionBlocked: 'Дозвіл заблоковано',
  micAccessRequired: 'Доступ до мікрофона\nнеобхідний',
  howToEnable: 'Як увімкнути:',
  permStep1: '1. Відкрити Налаштування',
  permStep2: '2. Знайти DroneEar',
  permStep3: '3. Увімкнути мікрофон',
  loadingAcousticModel: 'Завантаження акустичної моделі...',
  engineError: 'Помилка двигуна',
  engineErrorDesc: 'Не вдалося ініціалізувати двигун аналізу. Перевірте дозвіл мікрофона та спробуйте знову.',
  retry: 'ПОВТОРИТИ',
  stereo: 'СТЕРЕО',
  similarModels: 'СХОЖІ МОДЕЛІ',
  loadingDefault: 'Завантаження...',

  // Onboarding extra
  welcome: 'Вітаємо',
  acousticDroneDetection: 'Акустичне виявлення дронів',
  stepOf: (step, total) => `Крок ${step} з ${total}`,
  allow: 'ПРОДОВЖИТИ',
  selectDevice: 'Вибір пристрою',
  continueBtn: 'ПРОДОВЖИТИ',
  speakOrMakeSound: 'Говоріть або зробіть звук',
  listeningTest: 'СЛУХАЮ...',
  detectControllersDesc: 'Виявлення пультів дронів поблизу',
  enableBLE: 'ПРОДОВЖИТИ',
  startScanningBtn: 'ПОЧАТИ СКАНУВАННЯ',
};

// External language imports
import { ar } from './lang/ar';
import { ar_gulf } from './lang/ar_gulf';
import { he } from './lang/he';
import { hi } from './lang/hi';
import { ur } from './lang/ur';
import { tl } from './lang/tl';
import { de } from './lang/de';
import { es } from './lang/es';
import { fr } from './lang/fr';
import { it } from './lang/it';
import { zh } from './lang/zh';
import { ja } from './lang/ja';

export const TRANSLATIONS: Record<SupportedLocale, Translations> = {
  ko, en, uk,
  ar, ar_gulf, he, hi, ur, tl,
  de, es, fr, it,
  zh, ja,
};

/** Human-readable locale labels for settings UI */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ko: '한국어',
  en: 'English',
  uk: 'Українська',
  ar: 'العربية',
  ar_gulf: 'عربي خليجي',
  he: 'עברית',
  hi: 'हिन्दी',
  ur: 'اردو',
  tl: 'Filipino',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  zh: '简体中文',
  ja: '日本語',
};

export function getTranslation(locale: SupportedLocale): Translations {
  return TRANSLATIONS[locale] || TRANSLATIONS.ko;
}

/** Check if locale uses Right-to-Left text direction */
export function isRTL(locale: SupportedLocale): boolean {
  return RTL_LOCALES.includes(locale);
}
