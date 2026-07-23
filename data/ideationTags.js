/** Ideation tag categories — pick a category, then place a card on the board */
export const TAG_CATEGORIES = [
  {
    id: "mission",
    label: "MISSION",
    options: [
      {
        id: "mission-pace",
        body: "도시의 속도에 맞는 립을 만든다. 바르고, 말하고, 걷고 — 그 사이에서도 컬러가 무너지지 않게.",
      },
      {
        id: "mission-finish",
        body: "터치업 없는 하루를 위해, ‘바른 직후’의 완성도를 끝까지 유지한다.",
      },
      {
        id: "mission-signal",
        body: "말보다 먼저 보이는 도시의 신호 — 립 한 점으로 태도를 전달한다.",
      },
    ],
  },
  {
    id: "vision",
    label: "VISION",
    options: [
      {
        id: "vision-lang",
        body: "‘도시의 립’을 하나의 룩 언어로 정의하는 어반 립 카테고리의 기준 브랜드.",
      },
      {
        id: "vision-commute",
        body: "출퇴근·이동 중 메이크업의 표준을 바꾸는 시티 뷰티 플랫폼.",
      },
    ],
  },
  {
    id: "target",
    label: "TARGET",
    options: [
      {
        id: "target-commuter",
        body: "지하철·카페·미팅을 오가며, 한 번의 터치업으로 하루를 버티고 싶은 도시 라이프 메이크업 유저.",
      },
      {
        id: "target-creator",
        body: "숏폼·데일리룩을 찍는 20–30대. 화면에서도, 거리에서도 같은 립이 보이게.",
      },
    ],
  },
  {
    id: "keyword",
    label: "KEYWORD",
    options: [
      {
        id: "kw-core",
        body: "#도시의립  #UrbanLip  #Matte  #CommuteReady  #CityMood",
      },
      {
        id: "kw-street",
        body: "#StreetCandid  #SubwayCast  #BrickMatte  #NightSatin",
      },
      {
        id: "kw-pack",
        body: "#SlatePack  #SilverCap  #Exit3  #PocketReady",
      },
    ],
  },
  {
    id: "insight",
    label: "INSIGHT",
    options: [
      {
        id: "insight-mirror",
        body: "도시는 거울이 짧다. 립은 ‘한 번 확인’으로 끝나야 한다.",
      },
      {
        id: "insight-mood",
        body: "모델컷과 무드컷을 섞으면 브랜드가 흐려진다. 역할이 다른 보드다.",
      },
    ],
  },
  {
    id: "tone",
    label: "TONE",
    options: [
      {
        id: "tone-cool",
        body: "차갑고 세련된 도시 공기 + 따뜻한 립. 과하지 않은 자신감.",
      },
      {
        id: "tone-voice",
        body: "짧고 선명하게. ‘도시 위에서 완성된다’고 말한다.",
      },
    ],
  },
  {
    id: "constraint",
    label: "CONSTRAINT",
    options: [
      {
        id: "con-gloss",
        body: "과도한 글로시·글리터 립 금지. 매트·사틴만.",
      },
      {
        id: "con-pink",
        body: "러블리 핑크 일변도 무드 금지. 테라코타·브릭 중심.",
      },
    ],
  },
  {
    id: "opportunity",
    label: "OPPORTUNITY",
    options: [
      {
        id: "opp-name",
        body: "컬러 네임을 정류장·골목 코드로 (ex. Exit 3, Raspail).",
      },
      {
        id: "opp-cast",
        body: "테스트에서 고른 블루 니트 모델 1인 — 클로즈업·풀샷 10컷으로 메인 고정.",
      },
    ],
  },
  {
    id: "question",
    label: "QUESTION",
    options: [
      {
        id: "q-hero",
        body: "히어로 립은 Brick Matte인가, Night Satin인가?",
      },
      {
        id: "q-pack",
        body: "패키지 히어로는 슬레이트 바디 + 실버 캡으로 충분한가?",
      },
    ],
  },
  {
    id: "decision",
    label: "DECISION",
    options: [
      {
        id: "dec-cast",
        body: "메인 모델 = 블루 니트 1인 픽. Model Visual에 10컷만 올린다.",
      },
      {
        id: "dec-boards",
        body: "Model Visual ≠ Mood Board. 보드를 분리해 유지한다.",
      },
    ],
  },
];

export function getTagCategory(id) {
  return TAG_CATEGORIES.find((c) => c.id === id) || null;
}
