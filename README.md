# 대학지구 리더 경건 체크 웹

구글 설문지와 구글 스프레드시트를 연동해서, 이번 주차에 누가 입력했는지 웹에서 바로 확인할 수 있도록 만든 정적 웹 + Google Apps Script 예제입니다.

## 구성

- `index.html`: 입력 폼과 이번 주 현황 대시보드
- `styles.css`: 모바일 대응 포함 UI 스타일
- `app.js`: Apps Script API 연동, 스프레드시트의 주차 정보 반영, 테이블 렌더링
- `apps-script/Code.gs`: Google Sheets에 저장하고 대시보드 데이터를 반환하는 Apps Script

## 어떻게 동작하나요?

1. 리더가 웹에서 이름, Q.T 횟수, 성경 봉독 횟수를 입력합니다.
2. 제출 방식은 두 가지입니다.
3. `google-form` 모드: 웹이 Google Form의 `formResponse`로 전송하고, 응답은 연결된 스프레드시트에 저장됩니다.
4. `apps-script` 모드: 웹이 Apps Script 웹앱으로 직접 전송하고, Apps Script가 `설문지 응답 시트`의 마지막 행에 저장합니다.
5. 대시보드는 Apps Script의 `GET ?action=dashboard`를 호출해 스프레드시트에 적힌 이번 주차와 응답 여부를 읽고, `members` 시트와 비교해서 `입력 완료 / 미입력` 상태를 보여줍니다.

## 현재 사용 중인 시트에 바로 붙이는 모드

지금 받은 시트 링크 기준으로는 기존 표 헤더에서 아래 값이 확인되었습니다.

- `이름`
- `Q.T`
- `말씀`
- 추가 컬럼: `순번`, `토목 출석시간`, `지각비`, `벌금`, `사유`

그래서 [`apps-script/Code.gs`](/Users/timewarp/Documents/New%20project/apps-script/Code.gs)에 `EXISTING_CAMPUS_SHEET` 설정을 추가해 두었습니다.

```js
const EXISTING_CAMPUS_SHEET = {
  enabled: true,
  sheetName: '벌금계산',
  currentWeekCell: 'B1',
  headerRowNumber: 2,
  dataStartRowNumber: 3,
  nameColumnLetter: 'B',
  columnNames: {
    qtCount: 'Q.T',
    bibleCount: '말씀',
  },
  nonSubmittedValues: ['미제출', ''],
};
```

이 모드는 아래처럼 동작합니다.

- `벌금계산` 시트를 직접 읽습니다.
- `currentWeekCell` 값을 웹 상단의 주차 표시로 사용합니다.
- 헤더는 `2행`, 리더 데이터는 `3행부터 마지막 행까지` 자동으로 읽습니다.
- 이름은 `B열`, 체크 값은 헤더 이름 `Q.T`, `말씀`을 기준으로 입력 여부를 판단합니다.

중요:

- 현재 값은 알려주신 구조에 맞춰 `벌금계산!B1`, `벌금계산!B3:B` 기준으로 반영했습니다.
- 인원이 늘거나 줄어도 마지막 이름이 있는 행까지 자동으로 따라갑니다.
- `Q.T` 또는 `말씀`에 `미제출`이 아닌 값이 있으면 `입력 완료`로 처리합니다.

## 스프레드시트 준비

하나의 Google 스프레드시트를 만들고 아래 세 시트를 준비하세요.

### `members`

첫 줄 헤더:

```text
leaderName
```

예시:

```text
김다윗
박은혜
이요한
최사무엘
```

### `설문지 응답 시트`

웹에서 제출하면 이 시트의 `A:D` 마지막 행에 아래 순서로 추가됩니다.

```text
A: timestamp | B: leaderName | C: qtCount | D: bibleCount
```

### `settings`

현재 입력받을 주차 문구를 `B2` 셀에 적어 두세요.

예시:

```text
A1: key
B1: value
A2: currentWeek
B2: 4월 3주차
```

또는

```text
B2: 4월 14일 - 4월 20일
```

웹 상단의 현재 주차 표시와 제출 시 저장되는 `weekLabel` 값은 이 셀을 기준으로 동작합니다.

## Apps Script 연결

1. 스프레드시트에서 `확장 프로그램 > Apps Script`로 이동합니다.
2. 기본 코드를 지우고 [`apps-script/Code.gs`](/Users/timewarp/Documents/New%20project/apps-script/Code.gs) 내용을 붙여 넣습니다.
3. `배포 > 새 배포 > 웹 앱`으로 배포합니다.
4. 실행 사용자는 본인, 접근 권한은 사용 환경에 맞게 설정합니다.
5. 배포 URL을 복사합니다.
6. [`app.js`](/Users/timewarp/Documents/New%20project/app.js)의 아래 값을 바꿉니다.

```js
apiBaseUrl: "YOUR_APPS_SCRIPT_WEB_APP_URL"
```

Apps Script는 기본적으로 `settings!B2`를 읽도록 되어 있지만, `EXISTING_CAMPUS_SHEET.enabled = true`이면 기존 탭의 `currentWeekCell` 값을 우선 사용합니다.

## 구글 설문지와 연결하기

기본 설정은 `google-form` 모드입니다. 즉, 실제 제출은 Google Form으로 보내고, 대시보드는 Apps Script가 스프레드시트에서 읽어 옵니다.

### 1. Google Form 만들기

아래 질문을 가진 설문지를 만드세요.

- 이름
- Q.T 횟수
- 성경 봉독 횟수

Q.T 횟수와 성경 봉독 횟수는 `0~6` 선택형으로 두면 운영이 편합니다.

### 2. Form 응답을 스프레드시트에 연결

- 설문지의 `응답` 탭에서 스프레드시트 연결
- 같은 스프레드시트 안에 보통 `Form Responses 1` 시트가 생성됩니다.

### 3. `app.js`에 Form 정보 입력

[`app.js`](/Users/timewarp/Documents/New%20project/app.js)에서 다음을 수정하세요.

```js
submissionMode: "google-form",
googleForm: {
  actionUrl: "https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse",
  fields: {
    leaderName: "entry.1111111111",
    qtCount: "entry.2222222222",
    bibleCount: "entry.3333333333",
  },
}
```

- `actionUrl`은 설문 제출 URL입니다.
- `entry.xxxxx` 값은 각 질문의 내부 필드 ID입니다.
- 구글폼에는 `리더 이름`, `Q.T`, `성경 봉독 횟수` 세 항목만 두면 됩니다.

### 4. `Code.gs`에서 데이터 소스 변경

[`apps-script/Code.gs`](/Users/timewarp/Documents/New%20project/apps-script/Code.gs)에서 아래 값을 바꾸세요.

```js
const DATA_SOURCE = 'GOOGLE_FORM';
const FORM_RESPONSE_SHEET_NAME = 'Form Responses 1';
```

필요하면 `FORM_COLUMNS`의 숫자를 응답 시트 열 순서에 맞게 수정하세요.

## 주차 운영 방법

매주 스프레드시트의 `settings!B2` 값만 바꾸면 됩니다.

- 예: `4월 3주차`
- 예: `2026 봄학기 7주차`
- 예: `4월 14일 - 4월 20일`

이 값을 바꾸면 웹 상단 주차 표기와 새 제출 데이터의 주차 값이 함께 바뀝니다.

## 설문지 응답 시트에 바로 추가하고 싶다면

아래처럼 바꾸면 됩니다.

```js
// app.js
submissionMode: "apps-script"
```

이 모드에서는 웹 제출값이 `설문지 응답 시트`에 아래 순서로 누적됩니다.

- A열: 타임스탬프
- B열: 성명
- C열: Q.T 횟수
- D열: 성경봉독 횟수

## 로컬에서 열기

빌드 도구 없이 바로 열 수 있습니다.

1. [`index.html`](/Users/timewarp/Documents/New%20project/index.html)을 브라우저에서 엽니다.
2. 또는 정적 호스팅(Vercel, Netlify, GitHub Pages)에 올립니다.

## 다음으로 추천하는 확장

- 리더별 주차 기록 히스토리 보기
- 소그룹별 평균 Q.T / 봉독 횟수 통계
- 미입력 리더만 필터링
- 관리자 전용 비밀번호 또는 Google 로그인
