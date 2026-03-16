'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Info, Link, Check, MoreVertical } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isAdminUser } from '@/lib/auth-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChronotypeSelector } from '@/components/profile/ChronotypeSelector';
import { BigFiveSelector } from '@/components/profile/BigFiveSelector';
import { GoalsSection } from '@/components/profile/GoalsSection';
import ResizableTraitModal from '@/components/profile/ResizableTraitModal';
import { ChronotypeLoadingSpinner } from '@/components/LoadingSpinner';
import { formatDateAU } from '@/lib/date-utils';
import { SectionCard } from '@/components/ui/section-card';
import type { BigFiveGroup } from '@/types/profile';
import { SECTION_TITLE_SIZE } from '@/config/ui';

interface BigFiveProfileData {
  id?: string;
  opennessData?: any;
  conscientiousnessData?: any;
  extraversionData?: any;
  agreeablenessData?: any;
  neuroticismData?: any;
}

type ChronotypeType = 'Lion' | 'Bear' | 'Wolf' | 'Dolphin';

interface Profile {
  id: string;
  name: string;
  email: string;
  team: string | null;
  jobTitle?: string | null;
  birthday: string | null;
  chronotype: {
    types: ChronotypeType[];
    primaryType: ChronotypeType;
  } | null;
  coreValues: { values: string[] } | null;
  characterStrengths: { strengths: string[] } | null;
  bigFiveProfile?: BigFiveProfileData | null;
  bigFiveData?: BigFiveGroup[];
  goals?: {
    period: string;
    professionalGoals?: string | null;
    personalGoals?: string | null;
  } | null;
}

async function fetchProfile(id: string): Promise<Profile> {
  const response = await fetch(`/api/profiles/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  return response.json();
}

async function fetchBigFiveData(id: string): Promise<BigFiveGroup[]> {
  const response = await fetch(`/api/profiles/${id}/bigfive`);
  if (!response.ok) {
    throw new Error('Failed to fetch Big Five data');
  }
  const data = await response.json();
  return data.bigFiveData || [];
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [infoModal, setInfoModal] = useState<{ title: string; imageUrl: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const profileId = params.id as string;

  useEffect(() => {
    setIsAdmin(isAdminUser());
  }, []);

  const handleCopyLink = () => {
    if (linkCopied) return;

    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    toast.success('Link copied to clipboard!', {
      duration: 2000,
    });

    // Reset after toast duration
    setTimeout(() => {
      setLinkCopied(false);
    }, 2000);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!profile) return;

    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete profile');
      }

      toast.success('Profile deleted successfully');
      router.push('/users');
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Failed to delete profile');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  // Use React Query for data fetching with caching
  const { data: profile, isLoading, isError, error } = useQuery({
    queryKey: ['profile', profileId],
    queryFn: () => fetchProfile(profileId),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Lazy load Big Five data only if it exists
  const hasBigFive = profile?.bigFiveProfile?.id;
  const { data: bigFiveData } = useQuery({
    queryKey: ['bigFive', profileId],
    queryFn: () => fetchBigFiveData(profileId),
    enabled: !!profileId && !!hasBigFive,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <ChronotypeLoadingSpinner message="Loading profile..." />
      </main>
    );
  }

  if (isError || !profile) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Profile Not Found</h1>
          <p className="text-muted-foreground">
            {isError
              ? 'Unable to load this profile. Please try again later.'
              : 'The profile you are looking for does not exist or may have been removed.'}
          </p>
          <Button onClick={() => router.push('/users')} variant="default">
            Back to Directory
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-4 flex-1">
              <Button
                onClick={() => router.push('/users')}
                variant="ghost"
                size="icon"
                className="p-2"
                aria-label="Back to directory"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{profile.name}</h1>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                onClick={handleCopyLink}
                variant="secondary"
                className="w-full md:w-auto"
                disabled={linkCopied}
              >
                {linkCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </Button>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/admin/edit/${profileId}`)}
                      className="cursor-pointer"
                    >
                      Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      Delete Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Badge variant="outline" className="self-center whitespace-nowrap">READ-ONLY</Badge>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">

        {/* Basic Info, Core Values, Character Strengths */}
        <SectionCard className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Basic Information */}
            <div className="flex flex-col h-full">
              <h3 className="text-xl font-bold mb-3">Basic Info</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{' '}
                  <span className="text-foreground font-medium">{profile.name || 'Not set'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Team:</span>{' '}
                  <span className="text-foreground font-medium">{profile.team || 'Not set'}</span>
                </div>
                {profile.jobTitle && (
                  <div>
                    <span className="text-muted-foreground">Job Title:</span>{' '}
                    <span className="text-foreground font-medium">{profile.jobTitle}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Birthday:</span>{' '}
                  <span className="text-foreground font-medium">
                    {formatDateAU(profile.birthday)}
                  </span>
                </div>
              </div>
            </div>

            {/* Core Values */}
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-bold" style={{ color: '#E50202' }}>Core Values</h3>
                <Button
                  onClick={() => setInfoModal({ title: 'Core Values', imageUrl: '/core-values.png' })}
                  variant="ghost"
                  size="icon"
                  className="h-auto w-auto p-0 text-primary hover:text-primary/80"
                  aria-label="Learn more about Core Values"
                >
                  <Info className="w-5 h-5" />
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {profile.coreValues?.values && profile.coreValues.values.length > 0 ? (
                  profile.coreValues.values.filter(v => v).map((value, i) => (
                    <div key={i} className="text-foreground">{value}</div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic">Not set</div>
                )}
              </div>
            </div>

            {/* Character Strengths */}
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-bold" style={{ color: '#E18600' }}>Character Strengths</h3>
                <Button
                  onClick={() => setInfoModal({ title: 'Character Strengths', imageUrl: '/strengths.png' })}
                  variant="ghost"
                  size="icon"
                  className="h-auto w-auto p-0 text-primary hover:text-primary/80"
                  aria-label="Learn more about Character Strengths"
                >
                  <Info className="w-5 h-5" />
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {profile.characterStrengths?.strengths && profile.characterStrengths.strengths.length > 0 ? (
                  profile.characterStrengths.strengths.filter(s => s).map((strength, i) => (
                    <div key={i} className="text-foreground">{strength}</div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic">Not set</div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Chronotype */}
        <div className="mb-8">
          <h2 className={`${SECTION_TITLE_SIZE} font-semibold mb-4`} style={{ color: '#184DDA' }}>Chronotype</h2>
          <ChronotypeSelector
            selected={profile.chronotype?.types || []}
            onChange={() => {}}
            isReadOnly={true}
          />
        </div>

        {/* Big Five */}
        {hasBigFive ? (
          <div className="mb-8">
            <h2 className={`${SECTION_TITLE_SIZE} font-semibold text-big-five mb-4`}>
              Big 5 Factor of Personality
            </h2>
            {bigFiveData && bigFiveData.length > 0 ? (
              <BigFiveSelector
                data={bigFiveData}
                onChange={() => {}}
                isReadOnly={true}
              />
            ) : (
              <SectionCard>
                <div className="flex items-center justify-center py-8">
                  <ChronotypeLoadingSpinner message="Loading Big Five data..." />
                </div>
              </SectionCard>
            )}
          </div>
        ) : (
          <div className="mb-8">
            <h2 className={`${SECTION_TITLE_SIZE} font-semibold text-big-five mb-4`}>
              Big 5 Factor of Personality
            </h2>
            <SectionCard>
              <div className="text-center py-8 text-muted-foreground italic">
                Not set
              </div>
            </SectionCard>
          </div>
        )}

        {/* Goals */}
        <div className="mb-8">
          <GoalsSection
            goals={profile.goals}
            onChange={() => {}}
            isReadOnly={true}
          />
        </div>

        {/* Info Modal */}
        {infoModal && (
          <ResizableTraitModal
            title={infoModal.title}
            description=""
            imageUrl={infoModal.imageUrl}
            onClose={() => setInfoModal(null)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Profile</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{profile?.name}</strong>&apos;s profile?
                This action cannot be undone and will permanently remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
