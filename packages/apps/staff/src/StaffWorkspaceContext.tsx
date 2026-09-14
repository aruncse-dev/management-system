import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import type { StaffMember } from './types'

type StaffWorkspaceValue = {
  /**
   * Every staff member, active and inactive. Inactive people still own past
   * attendance, so dropping them here is what made history render raw ids.
   * Use `activeStaff` for anything that creates new records.
   */
  staffList: StaffMember[]
  /** Staff eligible for new attendance entry. */
  activeStaff: StaffMember[]
  /** Name lookup that also resolves people who have since been deactivated. */
  staffById: Map<string, StaffMember>
  staffLoading: boolean
  /** Set when the last `listStaff` request failed (initial or refresh). */
  staffError: string | null
  /** `soft`: refresh without toggling `staffLoading` (avoids full-page spinners when list already shown). */
  refreshStaff: (opts?: { soft?: boolean }) => Promise<void>
}

const StaffWorkspaceContext = createContext<StaffWorkspaceValue | null>(null)

export function StaffWorkspaceProvider({ children }: { children: ReactNode }) {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffError, setStaffError] = useState<string | null>(null)

  const refreshStaff = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true
    if (!soft) setStaffLoading(true)
    try {
      setStaffError(null)
      const list = await api.listStaff()
      setStaffList(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Load failed'
      setStaffError(msg)
      setStaffList([])
    } finally {
      if (!soft) setStaffLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStaff()
  }, [refreshStaff])

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList])
  const staffById = useMemo(() => new Map(staffList.map(s => [s.id, s])), [staffList])

  const value = useMemo(
    () => ({
      staffList,
      activeStaff,
      staffById,
      staffLoading,
      staffError,
      refreshStaff,
    }),
    [staffList, activeStaff, staffById, staffLoading, staffError, refreshStaff],
  )

  return <StaffWorkspaceContext.Provider value={value}>{children}</StaffWorkspaceContext.Provider>
}

export function useStaffWorkspace(): StaffWorkspaceValue {
  const ctx = useContext(StaffWorkspaceContext)
  if (!ctx) {
    throw new Error('useStaffWorkspace must be used under StaffWorkspaceProvider')
  }
  return ctx
}
