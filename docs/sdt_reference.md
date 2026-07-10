# SDT Motivation Generation Reference

Source: `기술 상세 설명서(자세한 버전).pdf`

## Psychological Factor Extraction

Analyze the requester's task metadata before writing any worker-facing message.

- Emotionally demanding signals -> possible emotional burden and need for autonomy support.
- Responsibility-critical signals -> possible pressure from the cost of mistakes.
- Repetitive cognitive signals -> possible boredom, fatigue, and need to emphasize finishability.
- Socially meaningful signals -> opportunity to connect the task with concrete public value.
- General low-stakes signals -> participation can be framed with appreciation and low-pressure choice.

## Category Classification Rules

Use these categories as the primary task classifier.

| Task Category | 주요 작업 특성 | 추출되는 심리 요인 |
| --- | --- | --- |
| Emotionally Demanding Tasks | 유해 콘텐츠 노출, 폭력/혐오 표현 평가 | 정서적 부담 가능성, 감정 소진 위험 |
| Responsibility-Critical Tasks | 의료·안전·교통 등 오류 비용이 큰 작업 | 책임감, 긴장감, 실수 부담 |
| Repetitive Cognitive Tasks | OCR, 반복 라벨링, 단순 검수 | 지루함, 인지 피로, 완료 가능성 강조 필요 |
| Socially Meaningful Tasks | 공익·헬스케어·접근성 향상 관련 작업 | 사회적 의미감, 기여감 |
| General Low-Stakes Tasks | 일반 설문, 선호도 조사, 단순 응답 | 낮은 부담감, 가벼운 참여 동기 |

When multiple categories apply, identify all matching categories but select one primary psychological task type for the final worker-facing message.

## Primary SDT Frame Selection Rules

Use only the two priority SDT frames for the primary psychological task type when synthesizing the final before-task message.

| 작업 심리 특성 유형 | 주요 심리 부담 | 우선 적용되는 SDT 프레임 | 적용 목적 |
| --- | --- | --- | --- |
| 정서적 부담 작업 | 정서적 소진, 감정 피로 | 관계성(감사·공감) + 자율성 지지 | 정서적 완충 및 심리적 거리 확보 |
| 책임 요구 작업 | 실수 부담, 긴장감, 책임감 | 유능감 + 의미감(관계성) | 작업 수행 자신감 및 사회적 책임 의미 강화 |
| 반복 인지 작업 | 지루함, 인지 피로, 몰입 저하 | 자율성 지지 + 유능감 | 작업 지속성 및 완료 가능성 강화 |
| 사회적 의미 작업 | 사회적 기여 인식 부족 가능성 | 의미감(관계성) + 유능감 | 사회적 기여감 및 참여 가치 강화 |
| 일반 저위험 작업 | 낮은 몰입도, 약한 참여 동기 | 관계성(감사) + 자율성 지지 | 가벼운 참여 유도 및 긍정적 경험 제공 |

## SDT Frame Definitions

- Meaningfulness / Relatedness: Connect the task with a concrete social or public value.
- Competence: Recognize the worker's careful judgment and ability without exaggeration.
- Autonomy support: Emphasize that the worker can proceed at a comfortable pace and should not guess when uncertain.
- Relatedness / Appreciation: Thank the worker for time, attention, and participation without making them feel obligated.

## Generation Constraints

- Write in Korean.
- Use exactly 5 complete, naturally connected sentences for each candidate message.
- The final before-task message has no sentence-count limit.
- When two SDT frames are selected, synthesize the final before-task message by naturally blending only the two matching before-task candidates.
- Do not use guilt-inducing expressions.
- Do not pressure productivity, speed, or performance.
- Include the concrete task goal at least once.
- Include the social impact at least once.
- Include wording that helps the worker positively recognize their competence and contribution.
- Include wording that implies the worker may participate at their own pace and in their own way.
- Avoid excessive praise, moral pressure, fear appeals, and inflated claims.
