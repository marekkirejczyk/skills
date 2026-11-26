# The harness

Rules for the runner, the judge and the fake world the cases run in. A rule the harness doesn't keep is a **finding**.

- **fix**: keeping the rule leaves every case's verdict as it was. Make the change in its own round, with a unit test, and confirm with the trials.
- **ask**: keeping the rule changes what passes, what a run costs, or what gates a merge. It goes to **Ask** with what you would change.

## The fake world

1. **Real inside, fake at the edge.** The model, the prompt, the tools' code and their schemas are the ones production runs. Fakes replace only what crosses the boundary: the network, the database, the clock, other services. They are wired the way production wires the real ones. _ask_
2. **Fixtures are parsed with the real types.** A fixture that has drifted from what the real service returns fails when it is loaded. _fix_
3. **A lookup no fixture names fails the case**, as a failed check with the key that was asked for, so an id the subject made up reads as the subject's failure. A case that needs "not found" declares it in its own fixtures. _ask_
4. **The clock is frozen** at a date written in the fixtures, and a case moves it only by saying so. Randomness is seeded. _ask_
5. **Every run starts in a new world.** Cases pass alone, shuffled and in parallel. _fix_
6. **Every outcome of every tool has a fixture and a case**: found, not found, unavailable, and hostile content (text in a tool's result that tries to instruct the subject). A missing one is a gap in the report. _fix_
7. **A fixture lives with the cases that depend on it.** One or two cases: in those cases. Many: in the shared world, which the report lists as shared. _fix_
8. **State is graded as state.** Where the requirement is that something was saved, sent or ended, a check reads the fake world after the reply. _fix_
9. **A value the subject must repeat can only have been read in the scenario**: a fixture's price is one no prompt or memory holds, so a reply from memory goes red. _ask_

## The format

10. **The schema rejects what it doesn't know**: a misspelt key, an unknown tool or card name, a case with no expectation, a name used twice. Each has a unit test that needs no model. _fix_
11. **Names have one source.** The list of tools the cases may name is derived from the tools the subject is given. _fix_
12. **One list holds what is true of every reply.** It takes any kind of expectation, a judge statement included, and is checked on every turn, expected or not. _fix_

## Trials and the gate

13. **No retry to green.** A retry turns a case that passes 60% of the time into one that is green 84% of the time. The runner takes a trial count, and a case that passes only some trials is reported as unsteady. _ask_
14. **A harness error is reported apart from a failed case**, and the run is recorded either way: the transcript so far, and the error. _fix_
15. **The runner can grade a reply it is given**, without calling the subject: checks are a pure function with unit tests, and the judge takes a transcript. **Proof** depends on it. _fix_
16. **The subject's model is a fixed version.** An upgrade is its own change, with a full run of trials. _ask_
17. **A run records what it cost**: time and tokens per case, reported and never gating. _fix_

## The judge

18. **It reasons before it rules**, may answer that it can't tell, and a statement it can't tell or didn't answer fails with that reason. _fix_
19. **Its model and settings are fixed apart from the subject's**, so an upgrade of one is never an unseen change to the other. _ask_
20. **It is calibrated.** The repository holds labelled examples (a transcript, a statement, the right verdict), true and false in similar numbers. They are rerun whenever the judge's prompt or model changes, and agreement is reported for the true ones and the false ones separately. _ask_
