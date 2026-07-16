import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

// 실제 AdMob 계정을 만들면 이 리워드 광고 단위 ID를 진짜 값으로 바꿔야 한다.
// 지금은 구글이 공식 제공하는 테스트 전용 ID(누구나 써도 되는 값 — 실제 수익은 안 남지만
// 전체 연동 구조를 미리 검증할 수 있다).
const REWARD_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917'
const IS_TEST_AD = true

let initialized = false
let adReady = false

export function isNativeAdsAvailable() {
  return Capacitor.isNativePlatform()
}

function preloadRewardAd() {
  if (!isNativeAdsAvailable()) return
  adReady = false
  AdMob.prepareRewardVideoAd({ adId: REWARD_AD_UNIT_ID, isTesting: IS_TEST_AD }).catch(() => {})
}

export async function initAdMob() {
  if (!isNativeAdsAvailable() || initialized) return
  initialized = true
  await AdMob.initialize({ initializeForTesting: IS_TEST_AD })
  await AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
    adReady = true
  })
  await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
    adReady = false
  })
  preloadRewardAd()
}

// 끝까지 봐서 보상을 받으면 onReward(), 중간에 닫거나 광고 자체가 실패하면 onNoReward()를
// 부른다. Dismissed는 "성공/실패 상관없이 광고 화면이 닫힘"에서 항상 불리는 이벤트라
// 이걸 기준으로 흐름을 끝내고, 그 직전에 Rewarded가 왔었는지로 결과를 가른다.
export function showRewardedAd(onReward, onNoReward) {
  if (!isNativeAdsAvailable()) {
    onNoReward()
    return
  }

  let rewarded = false
  let handled = false
  const listeners = []

  const finish = (fn) => {
    if (handled) return
    handled = true
    listeners.forEach((l) => l.remove())
    fn()
    preloadRewardAd()
  }

  Promise.all([
    AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true
    }),
    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded ? onReward : onNoReward)),
    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(onNoReward)),
  ]).then((handles) => listeners.push(...handles))

  const playPromise = adReady
    ? AdMob.showRewardVideoAd()
    : AdMob.prepareRewardVideoAd({ adId: REWARD_AD_UNIT_ID, isTesting: IS_TEST_AD }).then(() => AdMob.showRewardVideoAd())

  playPromise.catch(() => finish(onNoReward))
}
