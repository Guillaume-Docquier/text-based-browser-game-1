# CodeScene threshold justifications

`code-health-rules.json` overrides the CodeScene defaults in `template.json` for the following reasons.

## `**/*.test.ts`

| Threshold                                          | Default | Configured | Justification                                                                                                            |
| -------------------------------------------------- | ------: | ---------: | ------------------------------------------------------------------------------------------------------------------------ |
| `function_complex_conditional_branches_warning`    |       2 |          3 | 2 is a bit too intense.                                                                                                  |
| `function_duplication_min_lines_of_code_for_check` |      10 |         20 | Ignore short, commonly repeated test setup snippets.                                                                     |
| `function_duplication_min_similarity_percentage`   |      75 |         85 | Many tests a small modifications of other tests.                                                                         |
| `function_lines_of_code_warning`                   |      70 |        100 | Unit tests need room for explicit Arrange, Act, and Assert sections. We favor self contained tests, so they can get big. |

## `**/*.spec.ts`

| Threshold                                          | Default | Configured | Justification                                                               |
| -------------------------------------------------- | ------: | ---------: | --------------------------------------------------------------------------- |
| `function_complex_conditional_branches_warning`    |       2 |          3 | 2 is a bit too intense.                                                     |
| `function_duplication_min_lines_of_code_for_check` |      10 |         20 | Ignore short, commonly repeated scenario setup snippets.                    |
| `function_duplication_min_similarity_percentage`   |      75 |         85 | Only flag test duplication when the duplicated code is substantially alike. |
| `function_lines_of_code_warning`                   |      70 |        200 | Browser tests are usually larger than normal code.                          |

## `**/*.router.ts`

| Threshold                                       | Default | Configured | Justification                                                                                                                                    |
| ----------------------------------------------- | ------: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `function_complex_conditional_branches_warning` |       2 |          3 | 2 is a bit too intense.                                                                                                                          |
| `function_cyclomatic_complexity_warning`        |       9 |         15 | A `create*Router` function contains multiple route definitions, so CodeScene scores the whole router factory instead of each route individually. |
| `function_lines_of_code_warning`                |      70 |        200 | A `create*Router` function contains multiple route definitions, so CodeScene scores the whole router factory instead of each route individually. |

## `**/*`

| Threshold                                       | Default | Configured | Justification           |
| ----------------------------------------------- | ------: | ---------: | ----------------------- |
| `function_complex_conditional_branches_warning` |       2 |          3 | 2 is a bit too intense. |
