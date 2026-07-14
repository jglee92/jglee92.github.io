import { defineConfig } from 'vite'

// GitHub Pages 프로젝트 사이트는 https://<user>.github.io/<repo>/ 형태의 하위 경로에서
// 서빙되므로, base를 저장소 이름과 맞춰줘야 에셋 경로(js/css)가 깨지지 않는다.
export default defineConfig({
  base: '/close-rocket/',
})
