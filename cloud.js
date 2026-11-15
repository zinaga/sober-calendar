/* Optional Supabase sync. Local app works without this file being configured. */
let cloudClient=null, cloudUser=null, cloudTimer=null, cloudBusy=false, cloudReady=false;
const cloudStatus=document.getElementById('cloudStatus');
const cloudSetStatus=(msg)=>{cloudStatus.textContent=msg};
const cloudLogin=document.getElementById('login');
const cloudLogout=document.getElementById('logout');
const cloudSync=document.getElementById('syncNow');
const cloudEmail=document.getElementById('email');
function updateCloudUI(){cloudLogin.hidden=!!cloudUser;cloudEmail.hidden=!!cloudUser;cloudLogout.hidden=!cloudUser;cloudSync.hidden=!cloudUser}
function scheduleCloudSave(){if(!cloudReady||!cloudUser)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>void pushCloud(),850)}
async function pushCloud(){if(!cloudReady||!cloudUser)return;if(cloudBusy){scheduleCloudSave();return}cloudBusy=true;try{
 const {error}=await cloudClient.from('sober_records').upsert({user_id:cloudUser.id,days:data,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(error)throw error;cloudSetStatus('☁️ 동기화 완료 · '+new Date().toLocaleTimeString('ko-KR'));
}catch(err){cloudSetStatus('동기화 실패: '+err.message+' · 로컬 기록은 남아 있어요. JSON 백업을 권장해요.')}finally{cloudBusy=false}}
async function pullCloud(){if(!cloudUser)return;cloudReady=false;cloudSetStatus('클라우드 기록을 확인하고 있어요…');try{
 const {data:record,error}=await cloudClient.from('sober_records').select('days').eq('user_id',cloudUser.id).maybeSingle();
 if(error)throw error;
 const remote=record?.days||{};
 const local=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
 // Merge by date rather than asking users to overwrite an entire device.
 // When both sources contain different records for one date, preserve the cloud
 // version and keep a local recovery copy before merging.
 const conflicts=Object.keys(local).filter(k=>Object.prototype.hasOwnProperty.call(remote,k)&&JSON.stringify(local[k])!==JSON.stringify(remote[k]));
 if(conflicts.length){
  const backupKey='sober-calendar-recovery-'+cloudUser.id+'-'+Date.now();
  localStorage.setItem(backupKey,JSON.stringify(local));
  cloudSetStatus('기록 차이 '+conflicts.length+'일: 클라우드 기록을 우선 적용하고 이 기기의 이전 기록을 복구용으로 보관했어요.');
 }
 data={...local,...remote};
 localStorage.setItem(KEY,JSON.stringify(data));render();cloudReady=true;await pushCloud();
 }catch(err){cloudSetStatus('클라우드 불러오기 실패: '+err.message+' · 로컬 기록은 유지돼요.');cloudReady=false}}
async function setupCloud(){
 if(!window.SOBER_SUPABASE_URL||!window.SOBER_SUPABASE_PUBLISHABLE_KEY){cloudSetStatus('클라우드 미설정 · 현재 브라우저에만 저장 중 (config.js 설정 필요)');return}
 if(!window.supabase){cloudSetStatus('Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');return}
 cloudClient=window.supabase.createClient(window.SOBER_SUPABASE_URL,window.SOBER_SUPABASE_PUBLISHABLE_KEY);
 cloudClient.auth.onAuthStateChange((_event,session)=>{const old=cloudUser?.id;cloudUser=session?.user||null;updateCloudUI();if(cloudUser&&old!==cloudUser.id)setTimeout(()=>void pullCloud(),0);if(!cloudUser){cloudReady=false;cloudSetStatus('로그아웃됨 · 브라우저에만 저장 중')}});
 const {data:sessionInfo}=await cloudClient.auth.getSession();if(sessionInfo.session){cloudUser=sessionInfo.session.user;updateCloudUI();await pullCloud()}else cloudSetStatus('이메일로 로그인하면 클라우드 동기화가 시작돼요.');
}
cloudLogin.onclick=async()=>{const email=cloudEmail.value.trim();if(!email){alert('이메일 주소를 입력해 주세요.');return}try{const {error}=await cloudClient.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;cloudSetStatus('로그인 링크를 이메일로 보냈어요. 메일에서 링크를 열어 주세요.')}catch(e){cloudSetStatus('로그인 오류: '+e.message)}};
cloudLogout.onclick=async()=>{if(cloudClient)await cloudClient.auth.signOut()};
cloudSync.onclick=async()=>{if(cloudUser&&!cloudBusy)await pullCloud()};
void setupCloud();
