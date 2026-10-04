# DB 변경 없는 한국어 화면 AIO 운영 안내

공개 소스: https://github.com/aCafela-coffee/picpeak

공개 이미지: `ghcr.io/acafela-coffee/picpeak/aio:main`

## 고정 기준

- 공식 소스 커밋: `76492c11836fdf0e79e8cecfbc18e004e0cde9cc`
- 공식 AIO: `ghcr.io/picpeak/picpeak/aio@sha256:dde09c55e29bc40065f33d94a18f2cc90a604e5c02c4b62bd1dcd1a504226588`

아키텍처별 검증에서는 이 고정 manifest index에 속하는 AMD64·ARM64 digest를
확인하고 해당 이미지를 사용합니다. 두 기준은 루트의 `aio-baseline.json`에 함께 기록합니다. 빌드가 최신 공식
`main`을 자동으로 따라가지 않습니다. `Dockerfile.aio`는 위 공식 이미지의
프런트엔드 빌드 결과만 교체합니다. 백엔드, 의존성, 마이그레이션, 시작 명령,
환경 기본값, 볼륨, healthcheck는 공식 이미지에서 상속합니다.

이전 서버가 이 공식 버전보다 오래되었다면 **공식 버전의 기존 마이그레이션**은
실행될 수 있습니다. 한국어 포크가 추가하는 마이그레이션은 없습니다.

## 한국어 지원 범위

관리자 로그인과 사용자 메뉴, 설정 → 일반의 개인 화면 언어에서 **한국어**를
선택할 수 있습니다. 갤러리 로그인 및 각 갤러리 헤더, 고객 로그인 및 포털
헤더에서도 선택할 수 있습니다. `ko`, `ko-KR`을 지원하며 화면 날짜와 상대시간을
한국어로 표시합니다. 관리자가 지정한 숫자 날짜·시간 형식은 기존 동작을 따릅니다.

직접 선택한 언어는 `picpeak.screenLanguage`라는 브라우저 localStorage 키에만
저장하며 서버에 설정 저장 요청을 보내지 않습니다. 로그인·새로고침·페이지 이동
후에도 서버 언어 설정이 직접 선택한 화면 언어를 덮어쓰지 않습니다. 직접 선택하지
않으면 고객 선호 언어·사이트 기본 언어를 적용하는 기존 공식 동작을 유지합니다.
브라우저 저장소 사용을 차단한 경우에는 현재 탭에서만 선택을 유지합니다.
개인 화면 언어를 초기화하려면 사이트의 브라우저 저장 데이터를 삭제합니다.

고객 선호 언어, 사이트 기본 언어, 사업자 기본 언어, 이메일·문서·계약 언어
목록에는 한국어를 추가하지 않습니다. 사용자 작성 본문과 문서 내용도 번역하지
않습니다. API, DB 스키마, 통화 목록, 저장 단위, 환율·세금·회계 계산은 공식 버전과
같습니다. 이 이미지는 원화 회계 또는 한국어 이메일·PDF·계약 확장을 제공하지 않습니다.

기존 KRW·DB 확장 이미지의 SHA 태그(`55189812…`, `64b43004…`, `894b168f…`)는
이 범위에 해당하지 않습니다. 해당 태그로 실행하면 확장 마이그레이션이 적용될 수
있으므로 이번 전환에는 사용하지 않습니다. 해당 한국어 이미지는 운영에 사용하지
않았으므로 운영 데이터 복원이나 역마이그레이션은 필요하지 않습니다.

## 자동 검증과 게시

`.github/workflows/aio.yml`은 AMD64·ARM64 네이티브 러너에서 다음을 검사합니다.

- 공식 소스와 백엔드·마이그레이션·금액 함수의 동일성
- 영어·한국어 키 일치, 빈 문자열, 변수 및 복수형 보존
- 프런트엔드 타입·빌드, 화면 언어 유지 및 저장 범위 회귀 테스트
- 공식 이미지와 런타임 설정·파일·의존성 비교 (프런트엔드 dist만 제외)
- 임시 SQLite 볼륨을 공식 이미지로 초기화·재생성해 공식 이력을 확정한 뒤 공식 → 한국어 → 컨테이너 재생성 → 같은 공식 digest 복귀
- 각 단계에서 스키마·마이그레이션 이력·저장 언어·금액·JWT 비밀키 유지와
  로그인·이벤트·공유 링크·원본 사진 다운로드
- 실제 Chromium에서 관리자·고객·갤러리의 한국어 선택·로그인·새로고침·페이지 이동,
  서버 설정 저장 요청 부재, 데스크톱·모바일 배치

두 아키텍처의 모든 검사가 성공해야 검증한 이미지 자체를 게시합니다. PR은
게시하지 않습니다. 공개 패키지 `ghcr.io/acafela-coffee/picpeak/aio` 상태와 현재
`main` 커밋을 확인한 뒤 전체 커밋 SHA와 `main` 태그를 갱신합니다. 실패하면 기존
`main`을 유지합니다. 상속받은 Docker·릴리스 자동화는 `.yml.disabled`로 보관합니다.

로컬 검증은 다음 순서로 실행합니다. 운영 볼륨을 사용하지 않습니다.

```sh
git fetch https://github.com/PicPeak/picpeak.git 76492c11836fdf0e79e8cecfbc18e004e0cde9cc
node scripts/ci/check-official-source.cjs
node scripts/check-korean-locales.cjs
npm ci
npm ci --legacy-peer-deps --prefix frontend
npm run build:check --prefix frontend
# 예: ARM64. AMD64는 플랫폼과 태그의 arm64를 amd64로 바꿉니다.
docker build --platform linux/arm64 -f Dockerfile.aio -t picpeak-aio:verified-arm64 .
python3 scripts/ci/image-invariants.py picpeak-aio:verified-arm64
npx playwright install chromium
node scripts/ci/aio-smoke.cjs picpeak-aio:verified-arm64 linux/arm64
```

## 운영 전환과 복귀

운영 교체는 사용자가 수행합니다. 자동 검사는 합성 데이터만 사용하며 실제 NAS
데이터 복사본 검증을 대신하지 않습니다.

1. 현재 이미지 ID/digest와 Compose 파일을 보관합니다. 컨테이너를 중지하고
   `/share/container-ssd-s1/picpeak/data` 전체를 별도 위치에 복사합니다.
   `db`, `storage`, `logs`, `backup`, `db/jwt.secret`을 함께 보존하고 백업이
   읽히는지 확인합니다. 실행 중인 SQLite의 DB 파일만 복사하지 않습니다.
2. 데이터 복사본을 별도 볼륨·포트에 연결하고 이메일을 비활성화한 환경에서
   위 고정 공식 digest를 먼저 실행합니다. 오래된 서버의 공식 마이그레이션을
   확인한 뒤 한국어 이미지를 실행하고 다시 동일한 공식 digest로 돌아갑니다.
   로그인·이벤트·공유 링크·다운로드·재생성 후 데이터 유지와 저장값을 확인합니다.
3. 검증이 끝난 뒤 Compose의 **image 한 줄만** 변경합니다. 전체 SHA 태그로
   고정하는 것을 권장하며 `main`은 이후 검증된 게시에 따라 바뀝니다.

   ```yaml
   image: ghcr.io/acafela-coffee/picpeak/aio:<검증된 전체 커밋 SHA>
   ```

   기존 `/data` 마운트, 환경 설정, 컨테이너 이름, 재시작 정책은 유지합니다.
   해당 Compose 디렉터리에서 `docker compose pull <서비스명>`과
   `docker compose up -d <서비스명>`을 실행하고 같은 항목을 다시 확인합니다.
4. 이번 한국어 오버레이에서 복귀할 때는 다음 **검증된 공식 digest**로 image를
   바꾸고 기존 볼륨을 그대로 연결합니다.

   ```yaml
   image: ghcr.io/picpeak/picpeak/aio@sha256:dde09c55e29bc40065f33d94a18f2cc90a604e5c02c4b62bd1dcd1a504226588
   ```

복귀 보장은 위 고정 digest에 한정합니다. 이후 내용이 달라질 공식 `main`이나
더 오래된 공식 버전으로의 복귀는 검증 범위가 아닙니다. 공식 버전 자체의
업그레이드를 취소하여 더 오래된 이미지로 돌아가려면 교체 전 전체 데이터 백업도
함께 복원해야 할 수 있습니다.
