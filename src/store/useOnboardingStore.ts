"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CommonAnswers, ParsedTranscript, StudentProfileFull, SpecialStatus } from "@/types/onboarding";

type OnboardingState = {
  transcript: ParsedTranscript | null;
  commonAnswers: Partial<CommonAnswers> | null;
  specialStatus: SpecialStatus[];
  studentProfile: StudentProfileFull | null;
  setTranscript: (transcript: ParsedTranscript) => void;
  setCommonAnswers: (answers: Partial<CommonAnswers>) => void;
  setSpecialStatus: (values: SpecialStatus[]) => void;
  setStudentProfile: (profile: StudentProfileFull) => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      transcript: null,
      commonAnswers: null,
      specialStatus: ["해당없음"],
      studentProfile: null,
      setTranscript: (transcript) => set({ transcript }),
      setCommonAnswers: (commonAnswers) => set({ commonAnswers }),
      setSpecialStatus: (specialStatus) => set({ specialStatus }),
      setStudentProfile: (studentProfile) => set({ studentProfile }),
    }),
    {
      name: "skkolarship-onboarding",
    },
  ),
);

