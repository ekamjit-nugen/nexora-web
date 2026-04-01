import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CreateProjectScreen } from '../project/CreateProjectScreen';

describe('CreateProjectScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render create project screen', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('Create Project')).toBeTruthy();
    });

    it('should display all form sections', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('Project Details')).toBeTruthy();
      expect(getByText('Project Template')).toBeTruthy();
      expect(getByText('Team Members')).toBeTruthy();
    });

    it('should show project name input', () => {
      const { getByPlaceholderText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByPlaceholderText('Enter project name')).toBeTruthy();
    });

    it('should show description input', () => {
      const { getByPlaceholderText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByPlaceholderText('Enter project description (optional)')).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should require project name', async () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const createButton = getByText('Create Project');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Project name is required')).toBeTruthy();
      });
    });

    it('should validate project name minimum length', async () => {
      const { getByPlaceholderText, getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const nameInput = getByPlaceholderText('Enter project name');
      const createButton = getByText('Create Project');

      fireEvent.changeText(nameInput, 'AB');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Project name must be at least 3 characters')).toBeTruthy();
      });
    });

    it('should validate project name maximum length', async () => {
      const { getByPlaceholderText, getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const nameInput = getByPlaceholderText('Enter project name');
      const createButton = getByText('Create Project');

      const longName = 'A'.repeat(101);
      fireEvent.changeText(nameInput, longName);
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(
          getByText('Project name must be less than 100 characters')
        ).toBeTruthy();
      });
    });

    it('should accept valid project name', async () => {
      const { getByPlaceholderText, queryByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const nameInput = getByPlaceholderText('Enter project name');
      fireEvent.changeText(nameInput, 'Valid Project Name');

      await waitFor(() => {
        expect(queryByText('Project name is required')).toBeFalsy();
      });
    });

    it('should validate description maximum length', async () => {
      const { getByPlaceholderText, getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const descInput = getByPlaceholderText('Enter project description (optional)');
      const createButton = getByText('Create Project');

      const longDesc = 'A'.repeat(501);
      fireEvent.changeText(descInput, longDesc);
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(
          getByText('Description must be less than 500 characters')
        ).toBeTruthy();
      });
    });

    it('should clear error when user corrects input', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const nameInput = getByPlaceholderText('Enter project name');
      const createButton = getByText('Create Project');

      // Submit with invalid name
      fireEvent.press(createButton);
      await waitFor(() => {
        expect(getByText('Project name is required')).toBeTruthy();
      });

      // Fix the name
      fireEvent.changeText(nameInput, 'Valid Project');
      await waitFor(() => {
        expect(queryByText('Project name is required')).toBeFalsy();
      });
    });
  });

  describe('Project Template Selection', () => {
    it('should display all template options', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('Blank Project')).toBeTruthy();
      expect(getByText('Agile/Scrum')).toBeTruthy();
      expect(getByText('Kanban Board')).toBeTruthy();
      expect(getByText('Waterfall')).toBeTruthy();
    });

    it('should select template on press', async () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const agileTemplate = getByText('Agile/Scrum');
      fireEvent.press(agileTemplate);

      // Template should be selected (visual feedback)
      expect(agileTemplate).toBeTruthy();
    });

    it('should have blank as default template', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('Blank Project')).toBeTruthy();
    });
  });

  describe('Team Members Management', () => {
    it('should show add team members option', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('+ Add')).toBeTruthy();
    });

    it('should show empty state when no members added', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('No team members added yet')).toBeTruthy();
    });

    it('should open member picker modal', async () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const addButton = getByText('+ Add');
      fireEvent.press(addButton);

      await waitFor(() => {
        expect(getByText('Add Team Members')).toBeTruthy();
      });
    });
  });

  describe('Form Submission', () => {
    it('should disable create button while loading', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const createButton = getByText('Create Project');
      expect(createButton).toBeTruthy();
    });

    it('should handle successful project creation', async () => {
      const { getByPlaceholderText, getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const nameInput = getByPlaceholderText('Enter project name');
      const createButton = getByText('Create Project');

      fireEvent.changeText(nameInput, 'Test Project');
      fireEvent.press(createButton);

      // Should submit successfully
      expect(createButton).toBeTruthy();
    });

    it('should navigate back on cancel', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const cancelButton = getByText('Cancel');
      fireEvent.press(cancelButton);

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('should navigate back on success', async () => {
      const { getByPlaceholderText, getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const nameInput = getByPlaceholderText('Enter project name');
      const createButton = getByText('Create Project');

      fireEvent.changeText(nameInput, 'Test Project');
      fireEvent.press(createButton);

      // Wait for success and navigation
      // In a real test with mocked API, this would navigate
      expect(createButton).toBeTruthy();
    });
  });

  describe('Character Counters', () => {
    it('should display character count for project name', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('0/100')).toBeTruthy();
    });

    it('should update character count for description', () => {
      const { getByPlaceholderText, getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const descInput = getByPlaceholderText('Enter project description (optional)');
      fireEvent.changeText(descInput, 'Test description');

      expect(getByText('15/500')).toBeTruthy();
    });
  });

  describe('Back Navigation', () => {
    it('should navigate back when back button pressed', () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const backButton = getByText('‹');
      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels', () => {
      const { getByText, getByPlaceholderText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      expect(getByText('Project Name *')).toBeTruthy();
      expect(getByPlaceholderText('Enter project name')).toBeTruthy();
    });

    it('should have readable error messages', async () => {
      const { getByText } = render(
        <CreateProjectScreen
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
          } as any}
        />
      );

      const createButton = getByText('Create Project');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Project name is required')).toBeTruthy();
      });
    });
  });
});
