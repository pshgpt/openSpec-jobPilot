# Tasks

## 1. Align the test with the code

- [x] 1.1 In `test/llm.test.js`, rename the default-model test and change its expected `DEFAULT_MODEL` from `gemini-3.8-flash` to `gemini-3.1-flash-lite` (leave the `JOBPILOT_MODEL` override part unchanged); verify `npm test` reports 87 passing and 0 failing

## 2. Align the docs with the code

- [x] 2.1 In `README.md`'s Setup section, name `gemini-3.1-flash-lite` as the default and change the override example to `JOBPILOT_MODEL=gemini-3.8-flash`; verify `grep -n "3.8-flash\|3.1-flash-lite" README.md` shows the default and the example the right way round
- [x] 2.2 In `.env.example`, change the comment and the commented-out line to `gemini-3.1-flash-lite`; verify `node bin/jobpilot.js --help` still runs and no file outside `openspec/changes/archive/` names `gemini-3.8-flash` as the default (`grep -rn "3.8-flash" --exclude-dir=node_modules --exclude-dir=archive .`)

## Workflow follow-up

- Run `openspec validate fix-default-model-docs --strict` before archiving.
- Archive with `/opsx:archive`. There are no delta specs, so the main specs stay the same.
