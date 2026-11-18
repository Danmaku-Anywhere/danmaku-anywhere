import type { Season } from '@danmaku-anywhere/danmaku-model'
import { ChevronRight } from '@mui/icons-material'
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { rankBySeason, seasonNumberOf } from '@/common/anime/seasonRank'
import { ScrollBox } from '@/common/components/layout/ScrollBox'
import { TabLayout } from '@/common/components/layout/TabLayout'
import { PosterThumb } from '@/common/components/SearchPageCore/SeasonResultRow'
import { seasonProviderType } from '@/common/danmaku/utils'
import {
  PopupTab,
  type SeasonSelection,
  usePopup,
} from '@/content/controller/store/popupStore'

export const SelectorPage = () => {
  const { t } = useTranslation()

  const selection = usePopup((state) => state.selection)

  if (!selection || selection.seasons.length === 0) {
    return (
      <Box
        sx={{
          p: 2,
        }}
      >
        <Typography variant="h6">
          {t('selectorPage.noAnimeFound', 'Nothing to select from')}
        </Typography>
      </Box>
    )
  }

  return <SeasonSelector key={selection.id} selection={selection} />
}

interface SeasonGroups {
  likely: Season[]
  others: Season[]
}

function groupSeasons({ seasons, pageSeason }: SeasonSelection): SeasonGroups {
  if (pageSeason === undefined) {
    return { likely: [], others: seasons }
  }
  const { matches, others } = rankBySeason(seasons, pageSeason)
  return { likely: matches, others }
}

function SeasonSelector({ selection }: { selection: SeasonSelection }) {
  const { t } = useTranslation()
  const setTab = usePopup.use.setTab()
  const triggerSearchFocus = usePopup.use.triggerSearchFocus()

  const [applying, setApplying] = useState<Season>()

  const { likely, others } = groupSeasons(selection)

  const handlePick = async (season: Season) => {
    setApplying(season)
    try {
      await selection.apply(season)
    } finally {
      setApplying(undefined)
    }
  }

  const handleSearchManually = () => {
    setTab(PopupTab.Search)
    triggerSearchFocus()
  }

  const renderOptions = (seasons: Season[], isLikely: boolean) => {
    return seasons.map((season) => (
      <SeasonOption
        key={season.id}
        season={season}
        pageSeason={selection.pageSeason}
        likely={isLikely}
        applying={applying === season}
        disabled={applying !== undefined}
        onPick={handlePick}
      />
    ))
  }

  const renderGroups = () => {
    if (likely.length === 0 || others.length === 0) {
      return (
        <Stack spacing={0.5} data-testid="selector-group-all">
          {renderOptions([...likely, ...others], false)}
        </Stack>
      )
    }
    return (
      <Stack spacing={2}>
        <Stack spacing={0.5} data-testid="selector-group-likely">
          <GroupHeading label={t('selectorPage.likely', 'Likely')} />
          {renderOptions(likely, true)}
        </Stack>
        <Stack spacing={0.5} data-testid="selector-group-others">
          <GroupHeading
            label={t('selectorPage.otherResults', 'Other results')}
          />
          {renderOptions(others, false)}
        </Stack>
      </Stack>
    )
  }

  return (
    <TabLayout>
      <ScrollBox sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2, py: 2 }}>
        <Typography variant="h3">
          {t('selectorPage.title', 'Which season is this?')}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}
        >
          {t(
            'selectorPage.hint',
            'Several seasons match {{name}}. Click one to load its danmaku.',
            { name: selection.label }
          )}
        </Typography>
        {renderGroups()}
      </ScrollBox>
      <Divider />
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          flexShrink: 0,
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('selectorPage.notHere', 'Not here?')}
        </Typography>
        <Button
          variant="text"
          onClick={handleSearchManually}
          data-testid="selector-search-manually"
        >
          {t('selectorPage.searchManually', 'Search manually')}
        </Button>
      </Stack>
    </TabLayout>
  )
}

function GroupHeading({ label }: { label: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', pb: 0.5 }}>
      <Typography variant="overline">{label}</Typography>
      <Divider sx={{ flex: 1 }} />
    </Stack>
  )
}

interface SeasonOptionProps {
  season: Season
  pageSeason?: number
  likely: boolean
  applying: boolean
  disabled: boolean
  onPick: (season: Season) => void
}

function SeasonOption({
  season,
  pageSeason,
  likely,
  applying,
  disabled,
  onPick,
}: SeasonOptionProps) {
  const { t } = useTranslation()

  const seasonNumber = seasonNumberOf(season)
  const onPageSeason = seasonNumber === pageSeason
  const testId = `selector-option-${seasonProviderType(season)}-${season.id}`

  return (
    <ButtonBase
      onClick={() => onPick(season)}
      disabled={disabled}
      data-testid={testId}
      sx={(theme) => ({
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        padding: '8px 10px',
        borderRadius: 1.5,
        textAlign: 'left',
        bgcolor: likely ? alpha(theme.palette.primary.main, 0.08) : undefined,
        '&:hover': {
          bgcolor: likely
            ? alpha(theme.palette.primary.main, 0.16)
            : theme.palette.action.hover,
        },
        '&.Mui-focusVisible': { bgcolor: theme.palette.action.hover },
        '&.Mui-disabled': { opacity: 0.7 },
      })}
    >
      <PosterThumb src={season.imageUrl} alt={season.title} />
      <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.75}>
        <Typography
          variant="body2"
          title={season.title}
          data-testid="selector-option-title"
          sx={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {season.title}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          <Chip
            label={t('anime.numericSeason', 'Season {{season}}', {
              season: seasonNumber,
            })}
            color={onPageSeason ? 'primary' : 'default'}
          />
          {season.episodeCount !== undefined && (
            <Chip
              label={t('searchPage.epsCount', '{{count}} eps', {
                count: season.episodeCount,
              })}
            />
          )}
          {season.year !== undefined && <Chip label={season.year} />}
        </Stack>
      </Stack>
      {applying ? (
        <CircularProgress size={16} thickness={5} sx={{ flexShrink: 0 }} />
      ) : (
        <ChevronRight sx={{ color: 'text.secondary', flexShrink: 0 }} />
      )}
    </ButtonBase>
  )
}
