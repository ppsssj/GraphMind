# 🌐 GraphMind (MVP)

**GraphMind**는 사용자가 입력한 **수식 및 자연어 기반 명령어를 3D 그래프로 시각화**하는 데스크탑 애플리케이션입니다.  
수학적 개념을 직관적으로 탐색할 수 있는 인터페이스를 제공하며, 학습·연구·데이터 시각화 등 다양한 분야에 응용 가능성을 제시합니다.

---

## 🎯 프로젝트 개요
- **목표**  
  - 자연어로 표현된 수학적 함수를 파싱하여 3D 곡면으로 시각화  
  - 수학 학습, 데이터 이해, 연구 보조 도구로 활용할 수 있는 직관적인 인터페이스 제공
- **개발 기간**: 약 ○주  
- **개발 인원**: 개인 프로젝트 (Full-Stack 역할 수행)  
- **주요 성과**  
  - Electron 기반 멀티 플랫폼 지원 (Windows, macOS, Linux)  
  - 수학식 입력과 즉시 반영되는 3D 렌더링 구현  
  - VS Code / Obsidian 스타일의 미니멀한 UI 설계  

---

## 🛠️ 기술 스택
- **Frontend / Visualization**  
  - Three.js (3D 렌더링)  
  - Math.js (수식 파싱 및 연산)  
  - HTML / CSS / JavaScript (ES Modules)

- **Application Framework**  
  - Electron (데스크탑 앱 실행 환경)  
  - Vite (개발 서버 & 번들러)

- **개발 환경**  
  - Visual Studio Code  
  - Node.js (v18 이상)  

---

## 🚀 주요 기능
- **자연어 및 수식 입력**  
  - `z = x^2 + y^2`, `sin(x)*cos(y)` 형태의 입력 지원  
  - 기본적인 자연어 표현(예: “파라볼로이드”, “물결”)을 수식으로 자동 변환  
- **3D 그래프 시각화**  
  - 곡면 회전·확대·축소 및 마우스 기반 탐색  
  - 좌표축 및 격자(grid) 표시  
- **실시간 반영**  
  - 입력 변경 시 자동 갱신 (디바운스 적용)  
- **범위 및 해상도 제어**  
  - X, Y 범위 및 샘플링 해상도(Grid N) 설정 가능  

---

## 📂 프로젝트 구조
graphmind/
├─ package.json # 프로젝트 설정 및 의존성
├─ vite.config.js # Vite 설정
├─ electron-main.js # Electron 메인 프로세스
├─ README.md # 프로젝트 설명
└─ src/
├─ index.html # 메인 UI
├─ styles.css # UI 스타일
├─ plot.js # 3D 곡면 생성 로직
└─ renderer.js # 렌더링 및 이벤트 처리


---

## ⚙️ 실행 방법
### 1) 의존성 설치
npm install
## 2) 개발 모드 실행
npm run dev


## 📊 사용 예시
입력: z = sin(x)*cos(y)
→ 주기적인 파동 그래프 생성

입력: z = x^2 + y^2
→ 포물면(paraboloid) 생성

입력: z = exp(-0.1*(x^2+y^2))*sin(3*x)
→ 감쇠된 사인 곡면 생성

## 🔮 향후 확장 계획
고급 자연어 처리(NLP) 적용
복잡한 한국어/영어 설명을 함수로 자동 변환
색상 맵 및 등고선 추가
함수값 크기에 따라 색상 표현
저장 / 불러오기 기능
그래프 상태를 JSON 기반으로 관리
교육/연구 보조 기능
애니메이션(함수 변화 과정), 수학 교육용 인터랙션 제공
