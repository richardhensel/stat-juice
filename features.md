# Features

## Join

## Fill Gaps

## Surrogate

* Optional Self-recorded set of files

These are used directly in the output


* Optional surrogate

These are appended to the self-recorded datasets, but without the personalised data streams present (power, cadence, HR)


### Challenges

* We might not want to use all of the surrogate, if the surrogate activity began before the period together, or continued after the period together.
* If surrogete is before Self-recorded, need to specify whether to use entire surrogate or a certain time point after the startof surrogate.
* If surrogate is after self-recorded, need to specify whether to use entire surrogate or a certain time point before the start of surrogate.
* Always need to automatically identify the point at which the surrogate joins to the 
