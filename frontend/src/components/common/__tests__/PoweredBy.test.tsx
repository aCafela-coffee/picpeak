import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PoweredBy } from '../PoweredBy';
import { usePublicSettings } from '../../../hooks/usePublicSettings';
import i18n from '../../../i18n/config';

vi.mock('../../../hooks/usePublicSettings', () => ({
  usePublicSettings: vi.fn(),
}));

const mockUsePublicSettings = vi.mocked(usePublicSettings);

const setSettings = (data: Record<string, unknown> | undefined) => {
  mockUsePublicSettings.mockReturnValue({ data } as never);
};

describe('PoweredBy', () => {
  beforeEach(async () => {
    mockUsePublicSettings.mockReset();
    await i18n.changeLanguage('en');
  });

  it.each([
    ['ko', 'PicPeak 제공'],
    ['ko-KR', 'PicPeak 제공'],
    ['en', 'Powered by PicPeak'],
    ['de', 'Bereitgestellt von PicPeak'],
    ['fr', 'Propulsé par PicPeak'],
    ['es', 'Desarrollado por PicPeak'],
    ['nl', 'Mogelijk gemaakt door PicPeak'],
    ['pt', 'Desenvolvido por PicPeak'],
    ['ru', 'Работает на PicPeak'],
    ['sl', 'Poganja PicPeak'],
  ])('preserves word order and brand emphasis in %s', async (language, label) => {
    await i18n.changeLanguage(language);
    setSettings({});
    const { container } = render(<PoweredBy />);
    expect(container.textContent).toBe(label);
    expect(screen.getByText('PicPeak')).toHaveClass('font-semibold');
  });

  it('updates the attribution when the screen language changes', async () => {
    setSettings({});
    const { container } = render(<PoweredBy />);
    await act(() => i18n.changeLanguage('ko'));
    expect(container.textContent).toBe('PicPeak 제공');
  });

  it('renders the "Powered by PicPeak" attribution by default', () => {
    setSettings({});
    render(<PoweredBy />);
    expect(screen.getByText(/Powered by/)).toBeInTheDocument();
    expect(screen.getByText('PicPeak')).toBeInTheDocument();
  });

  it('renders nothing while settings are still loading (no attribution flash)', () => {
    setSettings(undefined);
    const { container } = render(<PoweredBy />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('PicPeak')).not.toBeInTheDocument();
  });

  it.each(['en', 'ko'])('hides the attribution in %s when white-labelled', async (language) => {
    await i18n.changeLanguage(language);
    setSettings({ branding_hide_powered_by: true });
    const { container } = render(<PoweredBy />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('PicPeak')).not.toBeInTheDocument();
  });

  it('renders when branding_hide_powered_by is explicitly false', () => {
    setSettings({ branding_hide_powered_by: false });
    render(<PoweredBy />);
    expect(screen.getByText('PicPeak')).toBeInTheDocument();
  });

  it('forwards className and style to the wrapping paragraph', () => {
    setSettings({});
    render(<PoweredBy className="text-xs mt-2" style={{ opacity: 0.5 }} />);
    const paragraph = screen.getByText('PicPeak').closest('p');
    expect(paragraph).toHaveClass('text-xs', 'mt-2');
    expect(paragraph).toHaveStyle({ opacity: '0.5' });
  });

  // The gallery footer appends the attribution to its copyright line, inside an
  // existing <p>. A nested <p> is invalid HTML, so that call site needs a span
  // and the leading separator (#1003).
  describe('inline variant', () => {
    it('renders a span, not a paragraph, so it can live inside one', () => {
      setSettings({});
      const { container } = render(<PoweredBy inline />);
      expect(screen.getByText('PicPeak').closest('p')).toBeNull();
      expect(container.querySelector('span')).not.toBeNull();
    });

    it('carries its own separator', () => {
      setSettings({});
      const { container } = render(<PoweredBy inline />);
      expect(container.textContent).toContain('| Powered by');
    });

    it('hides the separator along with the attribution when white-labelled', () => {
      // The separator has to be inside the component: a caller rendering its
      // own " | " would need to repeat the visibility guard, and would leave a
      // dangling separator the moment it drifted.
      setSettings({ branding_hide_powered_by: true });
      const { container } = render(<PoweredBy inline />);
      expect(container).toBeEmptyDOMElement();
      expect(container.textContent).not.toContain('|');
    });

    it('hides while settings are still loading, like the block variant', () => {
      setSettings(undefined);
      const { container } = render(<PoweredBy inline />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
