// Pure learning/reward contract shared by browser runtime and executable source checks.
const REWARD_CONTRACT_VERSION=4,TRAINER_VERSION=3;
const ROAD_PROGRESS_REWARD_PER_METER=.075,BACKWARD_PROGRESS_PENALTY_PER_METER=.16,TERMINAL_FAILURE_PENALTY=15,LAP_COMPLETION_REWARD=10;
const CLEAN_RESET_BASE_EXPERIENCES=2048,EXPLORATION_BASE_BATCH=512;
const LEARNING_SURFACE_REWARD={road:{forwardScale:1,timePenalty:0},shoulder:{forwardScale:.45,timePenalty:.07},grass:{forwardScale:0,timePenalty:.18}};
function learningSurfaceRewardProfile(surface){return LEARNING_SURFACE_REWARD[surface]||LEARNING_SURFACE_REWARD.grass}
function forwardProgressReward(progress,surface){return Math.max(0,Number(progress)||0)*ROAD_PROGRESS_REWARD_PER_METER*learningSurfaceRewardProfile(surface).forwardScale}
function backwardProgressPenalty(progress){return Math.min(0,Number(progress)||0)*BACKWARD_PROGRESS_PENALTY_PER_METER}
function surfaceTimePenalty(surface,dt){return-learningSurfaceRewardProfile(surface).timePenalty*Math.max(0,Number(dt)||0)}
function lapCompletionReward(){return LAP_COMPLETION_REWARD}
function terminalFailurePenalty(){return TERMINAL_FAILURE_PENALTY}
function explorationTemperatureForExperience(totalExperience){return Math.max(.72,1.35-(Math.max(0,Number(totalExperience)||0)/EXPLORATION_BASE_BATCH)*.005)}
function cleanResetExperienceInterval(multiplier){const n=Number(multiplier);return Number.isFinite(n)?Math.max(1,Math.trunc(n))*CLEAN_RESET_BASE_EXPERIENCES:Infinity}
