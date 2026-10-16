# GDWEB 자료 보강

`enrich_gdweb_http.py`는 GDWEB 선정 기록과 해당 기록의 원사이트에 공개된 HTML을 읽습니다. 브라우저 캡처를 만들거나 원본 이미지의 해상도를 키우지 않습니다.

```powershell
python enrich_gdweb_http.py --metadata-years 2026,2025 --materials-limit 180 --max-assets 10 --workers 4
python extract_gdweb_colors.py
python analyze_gdweb.py
node build_catalog.mjs
node test_catalog.mjs
```

- `--metadata-years`에 지정한 연도의 링크·태그가 부족한 기록을 보강합니다. 태그는 GDWEB 상세의 디자인 컨셉·표현방법·주색상 항목이며, 사이트 소개는 원사이트 메타 설명입니다. 기존 큐레이션을 덮어쓰지 않습니다.
- `--materials-limit`는 최신순 선정 기록의 최대 수입니다. 한 기록이 한 고유 도메인이라는 뜻은 아닙니다. 더 넓게 수집하려면 값을 늘립니다.
- 로고·파비콘·앱 아이콘·공유 이미지·배너를 우선 수집합니다. JS 실행이 필요한 사이트, 봇 차단, 인증서 오류, 사라진 URL에는 자료가 없을 수 있습니다. `--retry-failures`로 실패 항목을 다시 시도합니다.
- Google Play·App Store로 연결되는 선정 기록에는 실제 앱의 아이콘·소개 이미지만 남기며, 스토어 플랫폼의 로고·파비콘은 제외합니다.
- 상태는 `.gdweb-cache/enrichment-http/`에 항목별로 즉시 저장됩니다. 중단 후 같은 명령으로 재개할 수 있습니다. 기존 항목 키·캡처는 유지합니다.
- 출처 URL, 원본 SHA-256, 실제 크기, 수집 시간과 최적화 방식을 보존합니다. PNG는 RGBA 픽셀이 완전히 동일하고 용량이 작아질 때만 무손실 WebP로 변환합니다. SVG 등은 원본 바이트를 유지합니다.
- 큰 이미지의 카드 미리보기는 최대 960px입니다. 원본은 별도로 유지하며 440px 표시 기준 채널별 RMS 오차가 1.5/255 이하인 WebP 또는 무손실 WebP를 사용합니다. 작은 이미지는 확대하지 않습니다.
- `gdweb-enrichment-report.json`은 범위·성공·실패·실제 파일 수·용량을 기록합니다. 공개 HTML에 이미지가 없다는 결과를 전체 화면 캡처 성공으로 표시하지 않습니다.
- `gdweb-brand-colors.json`은 실제 로고·파비콘·앱 아이콘에서 추출한 참고 팔레트입니다. 공식 브랜드 가이드의 지정색이라는 의미가 아닙니다. 근거 자산과 출처 URL을 함께 보존하며 사진과 OG 이미지는 색상 추출에서 제외합니다.

보강은 `gdweb.json`과 `gdweb-static.json`을 함께 갱신합니다. 정적 카탈로그를 다시 내보낼 때는 기존 `export_gdweb_static.py`를 사용할 수 있습니다. 배포용 분할 카탈로그를 사용하는 경우 보강 후 해당 카탈로그 빌드도 다시 실행해야 합니다.
