import React from 'react';
import ReactDOM from 'react-dom/client';
import { Check, Download, RotateCcw, Settings, Trophy, Undo2, Vote } from 'lucide-react';
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/600.css';
import '@fontsource/sarabun/700.css';
import './styles/global.css';
import { contestants } from './data/contestants';
import {
  addMainVote,
  addTieBreakVote,
  clearTieBreakData,
  deleteMainVote,
  getAppState,
  getContestantProfiles,
  getMainVotes,
  getPhotos,
  getTieBreakRounds,
  getTieBreakVotes,
  resetVotingData,
  saveAppState,
  saveContestantProfiles,
  savePhoto,
  saveTieBreakRound
} from './db/votingDb';
import type {
  AppMode,
  Contestant,
  ContestantPhoto,
  ContestantProfile,
  PendingPodiumDecision,
  RankedContestant,
  TieBreakRound,
  TieBreakVoteRecord,
  VoteRecord
} from './types';
import { formatContestantNumber, rankLabel } from './utils/format';
import { createContestantProfiles, resolveContestants } from './utils/contestantProfiles';
import { ImageProcessingError, processContestantPhoto } from './utils/images';
import {
  calculateDenseRankings,
  calculateTotalsForIds,
  calculateVoteTotals,
  createTieBreakRound,
  createTieBreakVoteRecord,
  createVoteRecord,
  getLatestVote,
  resolveFinalPodium
} from './utils/voting';

type PhotoMap = Record<string, string>;
type Modal = 'undo' | 'reset' | 'all-scores' | 'tie-prompt' | null;

function App() {
  const [mode, setMode] = React.useState<AppMode>('setup');
  const [contestantProfiles, setContestantProfiles] = React.useState<ContestantProfile[]>([]);
  const [photos, setPhotos] = React.useState<PhotoMap>({});
  const [mainVotes, setMainVotes] = React.useState<VoteRecord[]>([]);
  const [tieBreakRounds, setTieBreakRounds] = React.useState<TieBreakRound[]>([]);
  const [tieBreakVotes, setTieBreakVotes] = React.useState<TieBreakVoteRecord[]>([]);
  const [selectedContestantId, setSelectedContestantId] = React.useState<string | null>(null);
  const [selectedTieContestantId, setSelectedTieContestantId] = React.useState<string | null>(null);
  const [activeTieRoundId, setActiveTieRoundId] = React.useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = React.useState<PendingPodiumDecision | null>(null);
  const [modal, setModal] = React.useState<Modal>(null);
  const [feedback, setFeedback] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [processingPhotoIds, setProcessingPhotoIds] = React.useState<Set<string>>(new Set());

  const photoUrlsRef = React.useRef<string[]>([]);

  const refreshData = React.useCallback(async () => {
    const [state, profiles, storedPhotos, votes, rounds, tieVotes] = await Promise.all([
      getAppState(),
      getContestantProfiles(),
      getPhotos(),
      getMainVotes(),
      getTieBreakRounds(),
      getTieBreakVotes()
    ]);

    for (const url of photoUrlsRef.current) {
      URL.revokeObjectURL(url);
    }

    const nextPhotos: PhotoMap = {};
    const urls: string[] = [];
    for (const photo of storedPhotos) {
      const url = URL.createObjectURL(photo.image);
      nextPhotos[photo.contestantId] = url;
      urls.push(url);
    }

    photoUrlsRef.current = urls;
    setContestantProfiles(profiles);
    setPhotos(nextPhotos);
    setMainVotes(votes);
    setTieBreakRounds(rounds);
    setTieBreakVotes(tieVotes);
    setMode(state.mode);
    setActiveTieRoundId(rounds.find((round) => round.status === 'active')?.id ?? null);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refreshData();
    return () => {
      for (const url of photoUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, [refreshData]);

  const displayContestants = React.useMemo(
    () => resolveContestants(contestants, contestantProfiles),
    [contestantProfiles]
  );
  const mainTotals = React.useMemo(() => calculateVoteTotals(displayContestants, mainVotes), [displayContestants, mainVotes]);
  const rankings = React.useMemo(() => calculateDenseRankings(mainTotals), [mainTotals]);
  const finalPodium = React.useMemo(
    () => resolveFinalPodium(rankings, tieBreakRounds, tieBreakVotes),
    [rankings, tieBreakRounds, tieBreakVotes]
  );
  const activeTieRound = tieBreakRounds.find((round) => round.id === activeTieRoundId);
  const latestVote = getLatestVote(mainVotes);
  const latestContestant = displayContestants.find((contestant) => contestant.id === latestVote?.contestantId);

  async function persistMode(nextMode: AppMode, votingStarted = true) {
    setMode(nextMode);
    await saveAppState({ mode: nextMode, votingStarted });
  }

  async function handlePhotoChange(contestantId: string, file: File | undefined) {
    if (!file) return;

    if (processingPhotoIds.has(contestantId)) {
      return;
    }

    console.debug('contestant photo input changed', {
      contestantId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });

    setProcessingPhotoIds((ids) => new Set(ids).add(contestantId));
    setFeedback('กำลังประมวลผลรูป...');

    try {
      const image = await processContestantPhoto(file);
      const photo: ContestantPhoto = {
        contestantId,
        image,
        updatedAt: new Date().toISOString()
      };
      await savePhoto(photo);
      await refreshData();
      console.debug('contestant photo saved', { contestantId, fileName: file.name });
      setFeedback('บันทึกรูปเรียบร้อย');
    } catch (error) {
      console.error('contestant photo processing failed', { contestantId, error });
      if (error instanceof ImageProcessingError && error.code === 'unsupported-format') {
        setFeedback('ไม่รองรับไฟล์รูปภาพประเภทนี้ กรุณาเลือก JPEG, PNG, WebP, HEIC หรือ HEIF');
      } else if (error instanceof ImageProcessingError && error.code === 'heic-conversion-failed') {
        setFeedback('ไม่สามารถอ่านไฟล์ HEIC/HEIF ได้ กรุณาลองเลือกรูปอื่น');
      } else {
        setFeedback('ไม่สามารถเพิ่มรูปได้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setProcessingPhotoIds((ids) => {
        const nextIds = new Set(ids);
        nextIds.delete(contestantId);
        return nextIds;
      });
    }
  }

  async function saveSetupNames(namesByContestantId: Record<string, string>) {
    const profiles = createContestantProfiles(contestants, namesByContestantId);
    await saveContestantProfiles(profiles);
    setContestantProfiles(profiles);
    setFeedback('บันทึกการตั้งค่าเรียบร้อยแล้ว');
  }

  async function saveSetupAndStartVoting(namesByContestantId: Record<string, string>) {
    await saveSetupNames(namesByContestantId);
    await startVoting();
  }

  async function startVoting() {
    setSelectedContestantId(null);
    await persistMode('voting');
  }

  async function saveMainVote() {
    if (!selectedContestantId) return;

    const vote = createVoteRecord(selectedContestantId);
    await addMainVote(vote);
    await clearTieBreakData();
    setMainVotes((votes) => [...votes, vote]);
    setTieBreakVotes([]);
    setTieBreakRounds([]);
    setActiveTieRoundId(null);
    setPendingDecision(null);
    setSelectedContestantId(null);
    setFeedback('บันทึกคะแนนแล้ว พร้อมสำหรับผู้โหวตคนถัดไป');
  }

  async function confirmUndoLatestVote() {
    if (!latestVote) return;

    await deleteMainVote(latestVote.id);
    await clearTieBreakData();
    setMainVotes((votes) => votes.filter((vote) => vote.id !== latestVote.id));
    setTieBreakVotes([]);
    setTieBreakRounds([]);
    setActiveTieRoundId(null);
    setPendingDecision(null);
    setModal(null);
    setFeedback('ยกเลิกคะแนนล่าสุดแล้ว');
  }

  async function confirmReset() {
    await resetVotingData();
    setMainVotes([]);
    setTieBreakVotes([]);
    setTieBreakRounds([]);
    setSelectedContestantId(null);
    setSelectedTieContestantId(null);
    setActiveTieRoundId(null);
    setPendingDecision(null);
    setModal(null);
    await persistMode('setup', false);
    setFeedback('Reset คะแนนเรียบร้อย โดยยังเก็บรูปผู้เข้าประกวดไว้');
  }

  function showResults() {
    setSelectedContestantId(null);
    setMode('results');
    void saveAppState({ mode: 'results', votingStarted: true });
  }

  async function closeResults() {
    await persistMode('voting');

    if (finalPodium.pendingDecision) {
      setPendingDecision(finalPodium.pendingDecision);
      setModal('tie-prompt');
    }
  }

  async function keepJointRank() {
    if (!pendingDecision) return;

    const round: TieBreakRound = {
      ...createTieBreakRound(pendingDecision.rank, pendingDecision.contestantIds, pendingDecision.sourceRoundId),
      status: 'kept-joint'
    };
    await saveTieBreakRound(round);
    setTieBreakRounds((rounds) => [...rounds, round]);
    setPendingDecision(null);
    setModal(null);
    await persistMode('results');
  }

  async function startTieBreak() {
    if (!pendingDecision) return;

    const round = createTieBreakRound(
      pendingDecision.rank,
      pendingDecision.contestantIds,
      pendingDecision.sourceRoundId
    );
    await saveTieBreakRound(round);
    setTieBreakRounds((rounds) => [...rounds, round]);
    setActiveTieRoundId(round.id);
    setSelectedTieContestantId(null);
    setPendingDecision(null);
    setModal(null);
    await persistMode('tie-break');
  }

  async function saveTieBreakVote() {
    if (!selectedTieContestantId || !activeTieRound) return;

    const vote = createTieBreakVoteRecord(activeTieRound.id, selectedTieContestantId);
    await addTieBreakVote(vote);
    setTieBreakVotes((votes) => [...votes, vote]);
    setSelectedTieContestantId(null);
    setFeedback('บันทึกคะแนนรอบตัดสินแล้ว');
  }

  async function finishTieBreakRound() {
    if (!activeTieRound) return;

    const closedRound: TieBreakRound = { ...activeTieRound, status: 'closed' };
    await saveTieBreakRound(closedRound);
    setTieBreakRounds((rounds) => rounds.map((round) => (round.id === closedRound.id ? closedRound : round)));
    setActiveTieRoundId(null);
    setSelectedTieContestantId(null);
    setFeedback('ปิดรอบตัดสินแล้ว');
    await persistMode('results');
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      mainVotes,
      mainTotals,
      tieBreakRounds,
      tieBreakVotes
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contest-voting-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="app-shell loading">กำลังเตรียมระบบโหวต...</div>;
  }

  return (
    <div className="app-shell">
      <header className="festival-header">
        <div>
          <h1>LOG Festival Contest</h1>
          <p className="eyebrow">ผู้เข้าร่วมการแข่งขันประกวดการแต่งตัว</p>
        </div>
        <div className="vote-counter" aria-live="polite">โหวตแล้ว {mainVotes.length} คน</div>
      </header>

      {feedback ? <div className="toast" role="status">{feedback}</div> : null}

      {mode === 'setup' ? (
        <SetupView
          contestants={displayContestants}
          photos={photos}
          onPhotoChange={handlePhotoChange}
          processingPhotoIds={processingPhotoIds}
          onSaveNames={saveSetupNames}
          onStartVoting={saveSetupAndStartVoting}
        />
      ) : null}

      {mode === 'voting' ? (
        <VotingView
          photos={photos}
          contestants={displayContestants}
          selectedContestantId={selectedContestantId}
          onSelect={setSelectedContestantId}
          onSave={saveMainVote}
          onShowResults={showResults}
          onSetup={() => void persistMode('setup', false)}
          onUndo={() => setModal('undo')}
          onReset={() => setModal('reset')}
          onAllScores={() => setModal('all-scores')}
          onExport={exportData}
          canUndo={mainVotes.length > 0}
        />
      ) : null}

      {mode === 'results' ? (
        <ResultsView photos={photos} contestants={displayContestants} rankings={finalPodium.placements} onClose={closeResults} />
      ) : null}

      {mode === 'tie-break' && activeTieRound ? (
        <TieBreakView
          round={activeTieRound}
          contestants={displayContestants}
          photos={photos}
          votes={tieBreakVotes}
          selectedContestantId={selectedTieContestantId}
          onSelect={setSelectedTieContestantId}
          onSave={saveTieBreakVote}
          onFinish={finishTieBreakRound}
        />
      ) : null}

      {modal === 'undo' ? (
        <ConfirmModal
          title="คะแนนล่าสุด"
          body={
            latestContestant
              ? `${formatContestantNumber(latestContestant.number)}\n${latestContestant.name}\n\nต้องการยกเลิกคะแนนล่าสุดหรือไม่?`
              : 'ยังไม่มีคะแนนล่าสุด'
          }
          cancelLabel="ยกเลิก"
          confirmLabel="ยืนยันการย้อนกลับ"
          danger
          onCancel={() => setModal(null)}
          onConfirm={confirmUndoLatestVote}
        />
      ) : null}

      {modal === 'reset' ? (
        <ConfirmModal
          title="ยืนยันการ Reset"
          body={'การ Reset จะลบคะแนนโหวตทั้งหมด\nแต่ไม่ลบรายชื่อและรูปผู้เข้าประกวด\n\nต้องการ Reset จริงหรือไม่?'}
          cancelLabel="ยกเลิก"
          confirmLabel="Reset"
          danger
          onCancel={() => setModal(null)}
          onConfirm={confirmReset}
        />
      ) : null}

      {modal === 'all-scores' ? (
        <AllScoresModal contestants={displayContestants} totals={mainTotals} onClose={() => setModal(null)} />
      ) : null}

      {modal === 'tie-prompt' && pendingDecision ? (
        <ConfirmModal
          title={pendingDecision.reason === 'tie-break-tied' ? 'ผลรอบตัดสินยังเสมอ' : 'พบคะแนนเสมอ'}
          body={
            pendingDecision.reason === 'tie-break-tied'
              ? `ผลรอบตัดสินอันดับ ${pendingDecision.rank} ยังเสมอ\nต้องการคงอันดับร่วม หรือเปิดโหวตรอบตัดสินอีกครั้ง?`
              : `อันดับ ${pendingDecision.rank} มีผู้เข้าประกวดมากกว่า 1 คน\nต้องการคงอันดับ ${pendingDecision.rank} ร่วม หรือเปิดโหวตรอบตัดสินอันดับ ${pendingDecision.rank}?`
          }
          cancelLabel={
            pendingDecision.reason === 'tie-break-tied'
              ? 'คงอันดับร่วม'
              : `คงอันดับ ${pendingDecision.rank} ร่วม`
          }
          confirmLabel={
            pendingDecision.reason === 'tie-break-tied'
              ? 'โหวตรอบตัดสินอีกครั้ง'
              : `โหวตตัดสินอันดับ ${pendingDecision.rank}`
          }
          onCancel={keepJointRank}
          onConfirm={startTieBreak}
        />
      ) : null}
    </div>
  );
}

function SetupView({
  contestants,
  photos,
  onPhotoChange,
  processingPhotoIds,
  onSaveNames,
  onStartVoting
}: {
  contestants: Contestant[];
  photos: PhotoMap;
  onPhotoChange: (contestantId: string, file: File | undefined) => Promise<void>;
  processingPhotoIds: Set<string>;
  onSaveNames: (namesByContestantId: Record<string, string>) => Promise<void>;
  onStartVoting: (namesByContestantId: Record<string, string>) => Promise<void>;
}) {
  const [namesByContestantId, setNamesByContestantId] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(contestants.map((contestant) => [contestant.id, contestant.name]))
  );

  React.useEffect(() => {
    setNamesByContestantId(Object.fromEntries(contestants.map((contestant) => [contestant.id, contestant.name])));
  }, [contestants]);

  function updateName(contestantId: string, displayName: string) {
    setNamesByContestantId((names) => ({
      ...names,
      [contestantId]: displayName
    }));
  }

  return (
    <main className="setup-page">
      <section className="mode-panel">
        <div>
          <p className="section-kicker">Setup Mode</p>
          <h2>ตั้งค่าผู้เข้าประกวด</h2>
        </div>
        <div className="setup-actions">
          <button className="secondary-action" type="button" onClick={() => void onSaveNames(namesByContestantId)}>
            บันทึกการตั้งค่า
          </button>
          <button className="primary-action" type="button" onClick={() => void onStartVoting(namesByContestantId)}>
            <Vote size={24} />
            กลับหน้าโหวต
          </button>
        </div>
      </section>
      <section className="setup-list" aria-label="ตั้งค่าผู้เข้าประกวด">
        {contestants.map((contestant) => (
          <article className="setup-row" key={contestant.id}>
            <div className="setup-number">{formatContestantNumber(contestant.number)}</div>
            <label className="name-field">
              <span>ชื่อผู้เข้าประกวด</span>
              <input
                type="text"
                value={namesByContestantId[contestant.id] ?? contestant.name}
                onChange={(event) => updateName(contestant.id, event.currentTarget.value)}
              />
            </label>
            <div className="setup-photo-preview">
              {photos[contestant.id] ? (
                <img src={photos[contestant.id]} alt={namesByContestantId[contestant.id] ?? contestant.name} />
              ) : (
                <span>ยังไม่ได้เพิ่มรูป</span>
              )}
            </div>
            <label className="file-field">
              <span>รูปผู้เข้าประกวด</span>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                disabled={processingPhotoIds.has(contestant.id)}
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  try {
                    await onPhotoChange(contestant.id, file);
                  } finally {
                    input.value = '';
                  }
                }}
              />
            </label>
          </article>
        ))}
      </section>
    </main>
  );
}

function VotingView({
  contestants,
  photos,
  selectedContestantId,
  onSelect,
  onSave,
  onShowResults,
  onSetup,
  onUndo,
  onReset,
  onAllScores,
  onExport,
  canUndo
}: {
  contestants: Contestant[];
  photos: PhotoMap;
  selectedContestantId: string | null;
  onSelect: (contestantId: string) => void;
  onSave: () => void;
  onShowResults: () => void;
  onSetup: () => void;
  onUndo: () => void;
  onReset: () => void;
  onAllScores: () => void;
  onExport: () => void;
  canUndo: boolean;
}) {
  const selectedContestant = contestants.find((contestant) => contestant.id === selectedContestantId);

  return (
    <main className="view-stack">
      <section className="voting-command">
        <div>
          <p className="section-kicker">Voting Mode</p>
          <h2>{selectedContestant ? `เลือก ${selectedContestant.name}` : 'เลือกผู้เข้าประกวด 1 คน'}</h2>
        </div>
        <button className="confirm-vote" type="button" disabled={!selectedContestantId} onClick={onSave}>
          <Check size={26} />
          ยืนยันและบันทึกผลการโหวต
        </button>
      </section>

      <ContestantGrid contestantsToShow={contestants} photos={photos} selectedContestantId={selectedContestantId} onSelect={onSelect} />

      <section className="presenter-tools" aria-label="เครื่องมือผู้ดำเนินรายการ">
        <button type="button" onClick={onShowResults}><Trophy size={18} />สรุปผลการโหวต</button>
        <button type="button" onClick={onAllScores}>ดูคะแนนทั้งหมด</button>
        <button type="button" disabled={!canUndo} onClick={onUndo}><Undo2 size={18} />ยกเลิกคะแนนล่าสุด</button>
        <button type="button" onClick={onExport}><Download size={18} />Export ข้อมูล</button>
        <button type="button" onClick={onSetup}><Settings size={18} />กลับ Setup</button>
        <button className="danger-link" type="button" onClick={onReset}><RotateCcw size={18} />Reset คะแนน</button>
      </section>
    </main>
  );
}

function ResultsView({
  photos,
  contestants,
  rankings,
  onClose
}: {
  photos: PhotoMap;
  contestants: Contestant[];
  rankings: RankedContestant[];
  onClose: () => void;
}) {
  const grouped = [2, 1, 3].map((rank) => ({
    rank,
    items: rankings.filter((item) => item.denseRank === rank)
  }));

  return (
    <main className="results-stage">
      <p className="section-kicker">Final Result</p>
      <h2>สรุปผลการโหวต</h2>
      {rankings.length === 0 ? (
        <div className="empty-result">ยังไม่มีผลการโหวต</div>
      ) : (
        <div className="rank-groups">
          {grouped.map(({ rank, items }) =>
            items.length > 0 ? (
              <section className={`rank-band rank-band-${rank}${items.length > 1 ? ' joint-rank' : ''}`} key={rank}>
                <h3>{rankLabel(rank, items.length > 1)}</h3>
                <div className="winners-grid">
                  {items.map((item) => {
                    const contestant = contestants.find((entry) => entry.id === item.contestantId);
                    return contestant ? <WinnerCard key={item.contestantId} contestant={contestant} photo={photos[item.contestantId]} /> : null;
                  })}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}
      <button className="primary-action" type="button" onClick={onClose}>ปิดหน้าผลลัพธ์</button>
    </main>
  );
}

function TieBreakView({
  round,
  contestants,
  photos,
  votes,
  selectedContestantId,
  onSelect,
  onSave,
  onFinish
}: {
  round: TieBreakRound;
  contestants: Contestant[];
  photos: PhotoMap;
  votes: TieBreakVoteRecord[];
  selectedContestantId: string | null;
  onSelect: (contestantId: string) => void;
  onSave: () => void;
  onFinish: () => void;
}) {
  const roundContestants = contestants.filter((contestant) => round.contestants.includes(contestant.id));
  const roundVotes = votes.filter((vote) => vote.roundId === round.id);
  const totals = calculateTotalsForIds(round.contestants, roundVotes);

  return (
    <main className="view-stack">
      <section className="voting-command tie-command">
        <div>
          <p className="section-kicker">Tie-break Mode</p>
          <h2>รอบตัดสินอันดับ {round.rank}</h2>
          <p className="tie-count">โหวตรอบตัดสินแล้ว {roundVotes.length} คน</p>
        </div>
        <button className="confirm-vote" type="button" disabled={!selectedContestantId} onClick={onSave}>
          <Check size={26} />
          ยืนยันคะแนนรอบตัดสิน
        </button>
      </section>
      <ContestantGrid
        contestantsToShow={roundContestants}
        photos={photos}
        selectedContestantId={selectedContestantId}
        onSelect={onSelect}
      />
      <section className="tie-summary">
        {roundContestants.map((contestant) => (
          <span key={contestant.id}>{formatContestantNumber(contestant.number)} — {totals[contestant.id]} คะแนน</span>
        ))}
      </section>
      <button className="secondary-action" type="button" onClick={onFinish}>สรุปผลรอบตัดสินนี้</button>
    </main>
  );
}

function ContestantGrid({
  contestantsToShow,
  photos,
  selectedContestantId,
  onSelect
}: {
  contestantsToShow: Contestant[];
  photos: PhotoMap;
  selectedContestantId?: string | null;
  onSelect?: (contestantId: string) => void;
}) {
  return (
    <section className={`contestant-grid ${contestantsToShow.length === 13 ? 'full-grid' : ''}`}>
      {contestantsToShow.map((contestant) => {
        const selected = selectedContestantId === contestant.id;
        return (
          <article className={`contestant-card ${selected ? 'selected' : ''}`} key={contestant.id}>
            <button
              className="contestant-select"
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect?.(contestant.id)}
            >
              <PhotoFrame photo={photos[contestant.id]} name={contestant.name} />
              {selected ? <span className="selected-badge"><Check size={18} />เลือกแล้ว</span> : null}
              <div className="contestant-meta">
                <span>{formatContestantNumber(contestant.number)}</span>
                <strong>{contestant.name}</strong>
              </div>
            </button>
          </article>
        );
      })}
    </section>
  );
}

function PhotoFrame({ photo, name }: { photo?: string; name: string }) {
  return (
    <div className="photo-frame">
      {photo ? <img src={photo} alt={name} /> : <span>รอรูปผู้เข้าประกวด</span>}
    </div>
  );
}

function WinnerCard({ contestant, photo }: { contestant: Contestant; photo?: string }) {
  return (
    <article className="winner-card">
      <PhotoFrame photo={photo} name={contestant.name} />
      <div>
        <span>{formatContestantNumber(contestant.number)}</span>
        <strong>{contestant.name}</strong>
      </div>
    </article>
  );
}

function ConfirmModal({
  title,
  body,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <section className="modal">
        <h2 id="modal-title">{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? 'danger-action' : 'primary-action'} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function AllScoresModal({
  contestants,
  totals,
  onClose
}: {
  contestants: Contestant[];
  totals: Record<string, number>;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scores-title">
      <section className="modal score-modal">
        <div className="modal-heading">
          <h2 id="scores-title">ดูคะแนนทั้งหมด</h2>
          <button className="modal-close" type="button" onClick={onClose}>ปิด</button>
        </div>
        <div className="score-list">
          {contestants.map((contestant) => (
            <div key={contestant.id}>
              <span>{formatContestantNumber(contestant.number)} — {contestant.name}</span>
              <strong>{totals[contestant.id] ?? 0} คะแนน</strong>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="primary-action" type="button" onClick={onClose}>ปิด</button>
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
