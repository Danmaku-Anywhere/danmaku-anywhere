import type { Locator, Page } from '@playwright/test'

// The season picker in the in-page controller window, shown when automatic
// matching found several seasons for the episode on the page.
export class SelectorPage {
  constructor(private readonly page: Page) {}

  // `provider` is the DanmakuSourceType enum value, e.g. 'DanDanPlay'.
  options(provider: string): Locator {
    return this.page.locator(`[data-testid^="selector-option-${provider}-"]`)
  }

  titleOf(option: Locator): Locator {
    return option.getByTestId('selector-option-title')
  }

  likelyGroup(): Locator {
    return this.page.getByTestId('selector-group-likely')
  }

  othersGroup(): Locator {
    return this.page.getByTestId('selector-group-others')
  }

  searchManuallyButton(): Locator {
    return this.page.getByTestId('selector-search-manually')
  }
}
