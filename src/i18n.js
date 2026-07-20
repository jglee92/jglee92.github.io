// 간단한 수동 토글 방식 다국어(i18n) 지원. 브라우저 로케일 자동 감지는 일부러 하지 않는다 —
// 기획자가 명시적으로 "그냥 랭귀지 클릭해서 한국어/외국어 스왑" 방식을 요청했다.
export const LANG_KEY = 'dodgeflyer-lang'

export function getLang() {
  const stored = localStorage.getItem(LANG_KEY)
  return stored === 'en' ? 'en' : 'ko'
}

export function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang === 'en' ? 'en' : 'ko')
}

export function toggleLang() {
  const next = getLang() === 'ko' ? 'en' : 'ko'
  setLang(next)
  return next
}

// 값은 고정 문자열이거나, 점수/닉네임 등 동적인 값을 끼워 넣어야 하는 경우 (params) => string
// 형태의 함수다. 이 게임 코드 대부분이 템플릿 리터럴로 텍스트를 만들기 때문에 필요하다.
export const translations = {
  ko: {
    // 티어 진입 알림 (ACHIEVEMENTS / START_TIER_TEXT)
    startTier: '☁️ 구름 지대 시작! 구름을 피하세요',
    achMeteor: '🌑 운석 지대 진입! 운석을 피하세요',
    achGalaxy: '🌌 은하 지대 진입! 은하를 피하세요',
    achBlackhole: '🕳️ 블랙홀 지대 진입! 블랙홀을 피하세요',
    achChaos: '☄️ 카오스 지대 진입! 구름·운석·은하·블랙홀이 랜덤하게 나와요',

    // 게임 방법 매뉴얼
    manualText:
      '🚀 화면을 탭하거나 스페이스바로 로켓을 밀어내요\n' +
      '🌪️ 중력 방향이 계속 서서히 바뀌어요\n' +
      '🔄 화면 벽에 닿으면 반대편으로 나와요\n' +
      '☁️ 장애물을 피하면 점수/코인을 얻어요\n' +
      '🛡️💣 아이템은 탭하면 바로 획득! 폭탄은 모아뒀다가\n   원할 때 다시 탭해서 써요\n' +
      '🛒 상점에서 코인으로 로켓/불꽃을 꾸밀 수 있어요',

    // 로켓 스킨 이름
    rocketSkinDefault: '기본',
    rocketSkinCrimson: '크림슨',
    rocketSkinAzure: '아주르',
    rocketSkinGold: '골드',
    rocketSkinNeon: '🌟 네온사이버 (한정)',
    rocketSkinHolo: '✨ 홀로그램',
    rocketSkinDiamond: '💎 다이아몬드 (한정)',

    // 불꽃 스킨 이름
    flameSkinDefault: '기본',
    flameSkinBlue: '블루 플레임',
    flameSkinGreen: '그린 플레임',
    flameSkinShadow: '🌑 다크 플레임 (한정)',
    flameSkinRainbow: '🌈 레인보우 플레임',
    flameSkinDiamond: '💎 다이아몬드 플레임 (한정)',

    // 광고 자리표시자
    adPlaceholder: '📺 광고 재생 중... (자리표시자)',
    adReadyMessage: '🎬 광고가 준비됐어요!',
    adWatchButton: '▶ 광고 보고 이어하기',

    // 아슬아슬 보너스 팝업
    nearMissBonus: '아슬아슬! +1',

    // 공용 뒤로가기 버튼(상점/랭킹)
    backButton: '← 뒤로',

    // 랭킹 화면
    leaderboardTitle: '🏆 전체 랭킹 TOP 10',
    leaderboardDisabled: '랭킹 기능은 아직 준비 중이에요!\n조금만 기다려주세요.',
    leaderboardLoading: '불러오는 중...',
    leaderboardEmpty: '아직 등록된 기록이 없어요.\n첫 번째 랭커가 되어보세요!',
    leaderboardStats: (p) => `최고 ${p.best}   평균 ${p.avg}   ${p.games}판`,
    leaderboardMyNickname: (p) => `내 닉네임: ${p.nickname}  ✏️ 변경`,
    leaderboardJoin: '✏️ 닉네임 정하고 참여하기',
    leaderboardDisclaimer: '⚠️ 욕설/비방성 닉네임은 예고 없이 삭제될 수 있어요.',

    // 닉네임 입력 다이얼로그 (랭킹 화면에서 다시 설정할 때)
    nicknamePromptMessage: '닉네임을 입력하세요 (최대 8자)',
    nicknamePromptConfirm: '확인',
    nicknamePromptCancel: '취소',
    nicknameBannedWord: '사용할 수 없는 닉네임이에요. 다른 닉네임을 입력해주세요.',

    // 매뉴얼을 처음 다 본 뒤 닉네임을 처음 물어볼 때
    nicknameFirstMessage: '🏆 전체 랭킹에 표시될 닉네임을 정해보세요!\n(최대 8자, 나중에 랭킹 화면에서도 설정 가능)',
    nicknameFirstConfirm: '저장하기',
    nicknameFirstSkip: '그냥하기',

    // 상점
    shopTitle: (p) => `🛒 상점   💰 ${p.coins}`,
    shopTabRocket: '🚀 로켓 스킨',
    shopTabFlame: '🔥 불꽃 색상',
    shopBonusRow: (p) => `🎁 아이템 확률 보너스   로켓 +${p.rocket}%   불꽃 +${p.flame}%`,
    shopEquipped: '✅ 장착중',
    shopOwned: '보유함 (선택)',
    shopLockedBoth: (p) => `🔒 ${p.streakReq}일 연속(${p.streakCur}일차) & 아슬아슬 ${p.nearMissReq}번(${p.nearMissCur}번)`,
    shopLockedStreak: (p) => `🔒 ${p.req}일 연속 접속 필요 (현재 ${p.cur}일차)`,
    shopLockedNearMiss: (p) => `🔒 아슬아슬 ${p.req}번 필요 (현재 ${p.cur}번)`,
    shopCost: (p) => `💰 ${p.cost}`,
    shopBonusOwned: (p) => `🎁 아이템 확률 +${p.percent}%`,
    shopBonusLocked: (p) => `🎁 획득 시 아이템 확률 +${p.percent}%`,
    shopLockedGeneric: '🔒 아직 해금 조건을 못 채웠어요!',
    shopNotEnoughCoins: '💰 코인이 부족해요!',

    // 대기화면
    readyCta: '탭하거나 스페이스바를 눌러 시작',
    readyBestScore: (p) => `최고 점수: ${p.best}`,
    readyStreakActive: (p) => `🔥 ${p.days}일 연속 접속 중!`,
    readyStreakNone: '오늘 첫 도전, 내일도 또 오세요!',
    readySubtitle: '(아슬로켓)',
    shopButtonLabel: (p) => `🛒 상점\n💰 ${p.coins}`,
    manualButtonLabel: '📖 게임 방법\n다시보기',
    leaderboardButtonLabel: '🏆 전체 랭킹 보기',
    langToggleLabel: '🌐 KO/EN',

    // 게임오버 / 이어하기
    continueButtonLabel: '📺 광고 보고 이어하기',
    continueReadyMessage: '탭하거나 스페이스바를 눌러 계속하기',
    restartYes: '✅ 예',
    restartNo: '❌ 아니오',
    gameOverTitle: '게임 오버\n다시 하시겠습니까?',
    gameOverStats: (p) =>
      `점수: ${p.score}   최고 점수: ${p.best}\n` +
      `아슬아슬: ${p.nearMiss}번   평균 점수: ${p.avg}\n` +
      `💰 획득: ${p.earned}   보유: ${p.total}`,

    // 매뉴얼 화면
    manualTitle: '📖 게임 방법',
    manualContinueCta: '👉 탭하거나 스페이스바를 눌러 시작',

    // 인게임 팝업
    setBonusActivated: (p) => `🎁 세트 효과 발동! 아이템 획득 확률 ${p.percent}% 증가!`,
    shieldFull: (p) => `🛡️ 실드 가득참! (${p.count}/${p.max})`,
    shieldCharged: (p) => `🛡️ 실드 충전! (${p.count}/${p.max})`,
    bombFull: (p) => `💣 폭탄 가득참! (${p.count}/${p.max})`,
    bombStored: (p) => `💣 폭탄 보관! (${p.count}/${p.max}) 탭해서 사용`,
    bombEffect: (p) => `💣 폭탄! +${p.count}`,
    newRecord: '🎉 신기록 달성!',

    // 아케이드 허브(게임 선택 화면)
    hubTitle: '게임 선택',
    hubSubtitle: '아케이드에서 즐길 게임을 골라보세요',
    hubGameRocketTitle: '아슬로켓',
    hubGameRocketDesc: '스쳐 지나갈수록 점수가 오르는 로켓 회피 게임',
    hubComingSoonTitle: '준비중',
    hubComingSoonDesc: '다음 게임을 준비하고 있어요',
    hubButtonLabel: '🏠 허브',
    hubGameFishingTitle: '아슬낚시',
    hubGameFishingDesc: '누르면 내려가고 떼면 올라와요. 물고기를 낚아 코인을 모으세요',
    hubGameBlockTitle: 'CLOSE PUZZLE',
    hubGameBlockDesc: '블록을 채워 가로/세로 줄을 완성하세요',

    // 아슬낚시 (영문 브랜드명: CLOSE FISHING)
    fishingReadyTitle: '🎣 아슬낚시',
    fishingReadyDesc: (p) => `누르고 있으면 바늘이 내려가고, 떼면 올라와요.\n물고기를 낚아 수면 위로 가져오면 코인 획득!\n보유 코인: ${p.coins}   최고 수확: ${p.best}`,
    fishingReadyCta: '👉 탭하거나 스페이스바로 시작',
    fishingUpgradeLabel: (p) => `🎣 낚싯대 강화 (${p.cost}코인)`,
    fishingUpgradeMax: '🎣 낚싯대 최고 단계',
    fishingTimeLeft: (p) => `⏱️ ${p.time}초`,
    fishingCatchPopup: (p) => `+${p.value}`,
    fishingBankPopup: (p) => `+${p.coins}코인`,
    fishingSnap: '💥 줄이 끊겼어요!',
    fishingRoundOverTitle: (p) => `🎣 이번 수확: ${p.coins}코인`,
    fishingRoundOverBest: (p) => `최고 수확: ${p.best}코인`,
    fishingNewBest: '🎉 신기록 달성!',

    // CLOSE PUZZLE
    blockReadyTitle: '🧩 CLOSE PUZZLE',
    blockReadyDesc: (p) => `블록을 끌어다 놓아 가로/세로 줄을 채우면 사라져요.\n보유 코인: ${p.coins}   최고 점수: ${p.best}`,
    blockReadyCta: '👉 탭하거나 스페이스바로 시작',
    blockScoreLabel: (p) => `점수: ${p.score}`,
    blockGameOverTitle: (p) => `🧩 게임 종료! 점수: ${p.score}`,
    blockGameOverBest: (p) => `최고 점수: ${p.best}`,
    blockNewBest: '🎉 신기록 달성!',
    blockCoinsEarned: (p) => `+${p.coins}코인`,
  },
  en: {
    startTier: '☁️ Cloud Zone begins! Dodge the clouds',
    achMeteor: '🌑 Meteor Zone reached! Dodge the meteors',
    achGalaxy: '🌌 Galaxy Zone reached! Dodge the galaxies',
    achBlackhole: '🕳️ Black Hole Zone reached! Dodge the black holes',
    achChaos: '☄️ Chaos Zone reached! Clouds, meteors, galaxies and black holes all appear at random',

    manualText:
      '🚀 Tap the screen or press Space to push the rocket\n' +
      '🌪️ Gravity keeps slowly, randomly shifting direction\n' +
      '🔄 Hit a screen edge and you wrap around to the other side\n' +
      '☁️ Dodge obstacles to earn score and coins\n' +
      '🛡️💣 Power-ups are collected the instant you tap! Bombs are stored —\n   tap again anytime to use them\n' +
      '🛒 Spend coins in the shop to customize your rocket/flame',

    rocketSkinDefault: 'Default',
    rocketSkinCrimson: 'Crimson',
    rocketSkinAzure: 'Azure',
    rocketSkinGold: 'Gold',
    rocketSkinNeon: '🌟 Neon Cyber (Limited)',
    rocketSkinHolo: '✨ Hologram',
    rocketSkinDiamond: '💎 Diamond (Limited)',

    flameSkinDefault: 'Default',
    flameSkinBlue: 'Blue Flame',
    flameSkinGreen: 'Green Flame',
    flameSkinShadow: '🌑 Dark Flame (Limited)',
    flameSkinRainbow: '🌈 Rainbow Flame',
    flameSkinDiamond: '💎 Diamond Flame (Limited)',

    adPlaceholder: '📺 Playing ad... (placeholder)',
    adReadyMessage: '🎬 Your ad is ready!',
    adWatchButton: '▶ Watch ad to continue',

    nearMissBonus: 'Close call! +1',

    backButton: '← Back',

    leaderboardTitle: '🏆 Global Ranking TOP 10',
    leaderboardDisabled: 'Leaderboard is coming soon!\nPlease check back later.',
    leaderboardLoading: 'Loading...',
    leaderboardEmpty: 'No records yet.\nBe the first to rank!',
    leaderboardStats: (p) => `Best ${p.best}   Avg ${p.avg}   ${p.games} games`,
    leaderboardMyNickname: (p) => `My nickname: ${p.nickname}  ✏️ Edit`,
    leaderboardJoin: '✏️ Set a nickname to join',
    leaderboardDisclaimer: '⚠️ Abusive or offensive nicknames may be removed without notice.',

    nicknamePromptMessage: 'Enter a nickname (max 8 characters)',
    nicknamePromptConfirm: 'OK',
    nicknamePromptCancel: 'Cancel',
    nicknameBannedWord: 'That nickname is not allowed. Please try another.',

    nicknameFirstMessage: '🏆 Choose a nickname to show on the global ranking!\n(Max 8 characters — you can change it later from the ranking screen)',
    nicknameFirstConfirm: 'Save',
    nicknameFirstSkip: 'Skip',

    shopTitle: (p) => `🛒 Shop   💰 ${p.coins}`,
    shopTabRocket: '🚀 Rocket Skins',
    shopTabFlame: '🔥 Flame Colors',
    shopBonusRow: (p) => `🎁 Item Chance Bonus   Rocket +${p.rocket}%   Flame +${p.flame}%`,
    shopEquipped: '✅ Equipped',
    shopOwned: 'Owned (tap to select)',
    shopLockedBoth: (p) => `🔒 ${p.streakReq}-day streak (day ${p.streakCur}) & ${p.nearMissReq} close calls (${p.nearMissCur})`,
    shopLockedStreak: (p) => `🔒 Requires a ${p.req}-day streak (currently day ${p.cur})`,
    shopLockedNearMiss: (p) => `🔒 Requires ${p.req} close calls (currently ${p.cur})`,
    shopCost: (p) => `💰 ${p.cost}`,
    shopBonusOwned: (p) => `🎁 Item chance +${p.percent}%`,
    shopBonusLocked: (p) => `🎁 +${p.percent}% item chance when obtained`,
    shopLockedGeneric: '🔒 Unlock requirements not met yet!',
    shopNotEnoughCoins: '💰 Not enough coins!',

    readyCta: 'Tap or press Space to start',
    readyBestScore: (p) => `Best score: ${p.best}`,
    readyStreakActive: (p) => `🔥 ${p.days}-day streak!`,
    readyStreakNone: "Today's first run — come back tomorrow too!",
    readySubtitle: '(Close Rocket)',
    shopButtonLabel: (p) => `🛒 Shop\n💰 ${p.coins}`,
    manualButtonLabel: '📖 How to Play\n(replay)',
    leaderboardButtonLabel: '🏆 View Rankings',
    langToggleLabel: '🌐 KO/EN',

    continueButtonLabel: '📺 Watch ad to continue',
    continueReadyMessage: 'Tap or press Space to continue',
    restartYes: '✅ Yes',
    restartNo: '❌ No',
    gameOverTitle: 'Game Over\nPlay again?',
    gameOverStats: (p) =>
      `Score: ${p.score}   Best: ${p.best}\n` +
      `Close calls: ${p.nearMiss}   Avg score: ${p.avg}\n` +
      `💰 Earned: ${p.earned}   Total: ${p.total}`,

    manualTitle: '📖 How to Play',
    manualContinueCta: '👉 Tap or press Space to start',

    setBonusActivated: (p) => `🎁 Set bonus active! Item chance increased by ${p.percent}%!`,
    shieldFull: (p) => `🛡️ Shield full! (${p.count}/${p.max})`,
    shieldCharged: (p) => `🛡️ Shield charged! (${p.count}/${p.max})`,
    bombFull: (p) => `💣 Bomb full! (${p.count}/${p.max})`,
    bombStored: (p) => `💣 Bomb stored! (${p.count}/${p.max}) Tap to use`,
    bombEffect: (p) => `💣 Bomb! +${p.count}`,
    newRecord: '🎉 New record!',

    // Arcade hub (game-select screen)
    hubTitle: 'Choose a Game',
    hubSubtitle: 'Pick a game to play in the arcade',
    hubGameRocketTitle: 'Close Rocket',
    hubGameRocketDesc: 'Dodge obstacles — the closer you get, the higher your score',
    hubComingSoonTitle: 'Coming Soon',
    hubComingSoonDesc: "We're working on the next game",
    hubButtonLabel: '🏠 Hub',
    hubGameFishingTitle: 'CLOSE FISHING',
    hubGameFishingDesc: 'Hold to descend, release to rise. Catch fish for coins',
    hubGameBlockTitle: 'CLOSE PUZZLE',
    hubGameBlockDesc: 'Fill rows and columns with blocks to clear them',

    // CLOSE FISHING
    fishingReadyTitle: '🎣 CLOSE FISHING',
    fishingReadyDesc: (p) =>
      `Hold to lower the hook, release to reel it up.\n` +
      `Bring caught fish back to the surface for coins!\n` +
      `Coins: ${p.coins}   Best catch: ${p.best}`,
    fishingReadyCta: '👉 Tap or press Space to start',
    fishingUpgradeLabel: (p) => `🎣 Upgrade rod (${p.cost} coins)`,
    fishingUpgradeMax: '🎣 Rod fully upgraded',
    fishingTimeLeft: (p) => `⏱️ ${p.time}s`,
    fishingCatchPopup: (p) => `+${p.value}`,
    fishingBankPopup: (p) => `+${p.coins} coins`,
    fishingSnap: '💥 Line snapped!',
    fishingRoundOverTitle: (p) => `🎣 Catch this round: ${p.coins} coins`,
    fishingRoundOverBest: (p) => `Best catch: ${p.best} coins`,
    fishingNewBest: '🎉 New record!',

    // CLOSE PUZZLE
    blockReadyTitle: '🧩 CLOSE PUZZLE',
    blockReadyDesc: (p) =>
      `Drag blocks onto the grid to fill rows/columns and clear them.\nCoins: ${p.coins}   Best score: ${p.best}`,
    blockReadyCta: '👉 Tap or press Space to start',
    blockScoreLabel: (p) => `Score: ${p.score}`,
    blockGameOverTitle: (p) => `🧩 Game Over! Score: ${p.score}`,
    blockGameOverBest: (p) => `Best score: ${p.best}`,
    blockNewBest: '🎉 New record!',
    blockCoinsEarned: (p) => `+${p.coins} coins`,
  },
}

export function t(key, params) {
  const lang = getLang()
  let value = translations[lang] ? translations[lang][key] : undefined
  if (value === undefined) value = translations.ko[key]
  if (typeof value === 'function') return value(params)
  return value
}
