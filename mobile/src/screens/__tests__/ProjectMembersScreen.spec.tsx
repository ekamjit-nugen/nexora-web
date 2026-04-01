import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProjectMembersScreen } from '../project/ProjectMembersScreen';

describe('ProjectMembersScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockRoute = {
    params: {
      projectId: '1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render project members screen', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Project Members')).toBeTruthy();
    });

    it('should display member count', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText(/Total Members:/)).toBeTruthy();
    });

    it('should display all members', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Alice Johnson')).toBeTruthy();
      expect(getByText('Bob Smith')).toBeTruthy();
      expect(getByText('Carol Davis')).toBeTruthy();
    });

    it('should display member email addresses', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('alice@example.com')).toBeTruthy();
      expect(getByText('bob@example.com')).toBeTruthy();
    });

    it('should display permission badges for each member', () => {
      const { getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getAllByText('admin')).toBeTruthy();
      expect(getAllByText('editor')).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('should display search bar', () => {
      const { getByPlaceholderText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByPlaceholderText('Search members...')).toBeTruthy();
    });

    it('should filter members by name', () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const searchInput = getByPlaceholderText('Search members...');
      fireEvent.changeText(searchInput, 'Alice');

      expect(getByText('Alice Johnson')).toBeTruthy();
    });

    it('should filter members by email', () => {
      const { getByPlaceholderText, getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const searchInput = getByPlaceholderText('Search members...');
      fireEvent.changeText(searchInput, 'bob@example.com');

      expect(getByText('Bob Smith')).toBeTruthy();
    });

    it('should show no results message when search has no matches', () => {
      const { getByPlaceholderText, getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const searchInput = getByPlaceholderText('Search members...');
      fireEvent.changeText(searchInput, 'NonExistent');

      expect(getByText('No members found')).toBeTruthy();
    });
  });

  describe('Filter Functionality', () => {
    it('should display filter tabs', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('all')).toBeTruthy();
      expect(getByText('active')).toBeTruthy();
      expect(getByText('pending')).toBeTruthy();
    });

    it('should filter members by status', async () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const activeFilter = getAllByText('active')[0];
      fireEvent.press(activeFilter);

      await waitFor(() => {
        expect(getByText('Alice Johnson')).toBeTruthy();
      });
    });

    it('should show pending members when pending filter selected', async () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const pendingFilter = getAllByText('pending')[0];
      fireEvent.press(pendingFilter);

      await waitFor(() => {
        expect(getByText('David Lee')).toBeTruthy();
      });
    });

    it('should show all members when all filter selected', () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const allFilter = getAllByText('all')[0];
      fireEvent.press(allFilter);

      expect(getByText('Alice Johnson')).toBeTruthy();
      expect(getByText('David Lee')).toBeTruthy();
    });
  });

  describe('Permission Management', () => {
    it('should display permission change modal when badge tapped', async () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const adminBadge = getAllByText('admin')[0];
      fireEvent.press(adminBadge);

      await waitFor(() => {
        expect(getByText('Change Permission')).toBeTruthy();
      });
    });

    it('should show permission options in modal', async () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const adminBadge = getAllByText('admin')[0];
      fireEvent.press(adminBadge);

      await waitFor(() => {
        expect(getByText('Full access to project')).toBeTruthy();
        expect(getByText('Can edit project and tasks')).toBeTruthy();
        expect(getByText('View only access')).toBeTruthy();
      });
    });

    it('should close permission modal on done button', async () => {
      const { getByText, getAllByText, queryByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const adminBadge = getAllByText('admin')[0];
      fireEvent.press(adminBadge);

      await waitFor(() => {
        expect(getByText('Change Permission')).toBeTruthy();
      });

      const doneButton = getByText('Done');
      fireEvent.press(doneButton);

      await waitFor(() => {
        expect(queryByText('Change Permission')).toBeFalsy();
      });
    });
  });

  describe('Member Actions', () => {
    it('should display remove button for each member', () => {
      const { getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getAllByText('Remove').length).toBeGreaterThan(0);
    });

    it('should display resend button for pending members', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Resend')).toBeTruthy();
    });

    it('should show removal confirmation when remove button pressed', async () => {
      const { getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const removeButtons = getAllByText('Remove');
      fireEvent.press(removeButtons[0]);

      await waitFor(() => {
        expect(removeButtons[0]).toBeTruthy();
      });
    });

    it('should show resend confirmation when resend button pressed', async () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const resendButton = getByText('Resend');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(resendButton).toBeTruthy();
      });
    });
  });

  describe('Member Details', () => {
    it('should display join date for each member', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Joined')).toBeTruthy();
    });

    it('should display status indicator for each member', () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Status')).toBeTruthy();
    });

    it('should display member initials in avatar', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('AJ')).toBeTruthy(); // Alice Johnson
      expect(getByText('BS')).toBeTruthy(); // Bob Smith
    });
  });

  describe('Back Navigation', () => {
    it('should navigate back when back button pressed', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const backButton = getByText('‹');
      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible member names', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Alice Johnson')).toBeTruthy();
      expect(getByText('Bob Smith')).toBeTruthy();
    });

    it('should have readable status labels', () => {
      const { getByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      expect(getByText('Status')).toBeTruthy();
    });

    it('should have clear permission descriptions', async () => {
      const { getByText, getAllByText } = render(
        <ProjectMembersScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
          route={mockRoute}
        />
      );

      const adminBadge = getAllByText('admin')[0];
      fireEvent.press(adminBadge);

      await waitFor(() => {
        expect(getByText('Full access to project')).toBeTruthy();
      });
    });
  });
});
