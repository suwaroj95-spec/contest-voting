import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AppState,
  ContestantPhoto,
  ContestantProfile,
  TieBreakRound,
  TieBreakVoteRecord,
  VoteRecord
} from '../types';
import { initialAppState } from '../utils/voting';

const DB_NAME = 'contest-voting-db';
const DB_VERSION = 2;
const APP_STATE_KEY = 'state';

interface ContestVotingSchema extends DBSchema {
  photos: {
    key: string;
    value: ContestantPhoto;
  };
  contestantProfiles: {
    key: string;
    value: ContestantProfile;
  };
  mainVotes: {
    key: string;
    value: VoteRecord;
    indexes: { 'by-createdAt': string };
  };
  tieBreakRounds: {
    key: string;
    value: TieBreakRound;
    indexes: { 'by-createdAt': string };
  };
  tieBreakVotes: {
    key: string;
    value: TieBreakVoteRecord;
    indexes: { 'by-roundId': string; 'by-createdAt': string };
  };
  appState: {
    key: string;
    value: AppState;
  };
}

let dbPromise: Promise<IDBPDatabase<ContestVotingSchema>> | undefined;

function getDb() {
  dbPromise ??= openDB<ContestVotingSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'contestantId' });
      }

      if (!db.objectStoreNames.contains('contestantProfiles')) {
        db.createObjectStore('contestantProfiles', { keyPath: 'contestantId' });
      }

      if (!db.objectStoreNames.contains('mainVotes')) {
        const mainVotes = db.createObjectStore('mainVotes', { keyPath: 'id' });
        mainVotes.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('tieBreakRounds')) {
        const tieBreakRounds = db.createObjectStore('tieBreakRounds', { keyPath: 'id' });
        tieBreakRounds.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('tieBreakVotes')) {
        const tieBreakVotes = db.createObjectStore('tieBreakVotes', { keyPath: 'id' });
        tieBreakVotes.createIndex('by-roundId', 'roundId');
        tieBreakVotes.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('appState')) {
        db.createObjectStore('appState');
      }
    }
  });

  return dbPromise;
}

export async function getPhotos() {
  return (await getDb()).getAll('photos');
}

export async function savePhoto(photo: ContestantPhoto) {
  await (await getDb()).put('photos', photo);
}

export async function getContestantProfiles() {
  return (await getDb()).getAll('contestantProfiles');
}

export async function saveContestantProfiles(profiles: ContestantProfile[]) {
  const db = await getDb();
  const tx = db.transaction('contestantProfiles', 'readwrite');
  await Promise.all([
    ...profiles.map((profile) => tx.store.put(profile)),
    tx.done
  ]);
}

export async function getMainVotes() {
  return (await getDb()).getAll('mainVotes');
}

export async function addMainVote(vote: VoteRecord) {
  await (await getDb()).put('mainVotes', vote);
}

export async function deleteMainVote(voteId: string) {
  await (await getDb()).delete('mainVotes', voteId);
}

export async function getTieBreakRounds() {
  return (await getDb()).getAll('tieBreakRounds');
}

export async function saveTieBreakRound(round: TieBreakRound) {
  await (await getDb()).put('tieBreakRounds', round);
}

export async function getTieBreakVotes() {
  return (await getDb()).getAll('tieBreakVotes');
}

export async function addTieBreakVote(vote: TieBreakVoteRecord) {
  await (await getDb()).put('tieBreakVotes', vote);
}

export async function clearTieBreakData() {
  const db = await getDb();
  const tx = db.transaction(['tieBreakVotes', 'tieBreakRounds'], 'readwrite');
  await Promise.all([
    tx.objectStore('tieBreakVotes').clear(),
    tx.objectStore('tieBreakRounds').clear(),
    tx.done
  ]);
}

export async function getAppState() {
  const state = await (await getDb()).get('appState', APP_STATE_KEY);
  return state ?? initialAppState;
}

export async function saveAppState(state: AppState) {
  await (await getDb()).put('appState', state, APP_STATE_KEY);
}

export async function resetVotingData() {
  const db = await getDb();
  const tx = db.transaction(['mainVotes', 'tieBreakVotes', 'tieBreakRounds', 'appState'], 'readwrite');
  await Promise.all([
    tx.objectStore('mainVotes').clear(),
    tx.objectStore('tieBreakVotes').clear(),
    tx.objectStore('tieBreakRounds').clear(),
    tx.objectStore('appState').put({ mode: 'setup', votingStarted: false }, APP_STATE_KEY),
    tx.done
  ]);
}
