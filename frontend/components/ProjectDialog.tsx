'use client';
import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Textarea,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { ProjectType, ProjectDialogMessages } from '@/types/project';

type Props = {
  isOpen: boolean;
  editingProject: ProjectType | null;
  onCancel: () => void;
  onSubmit: (name: string, detail: string, isPublic: boolean, testUrl: string) => void;
  projectDialogMessages: ProjectDialogMessages;
};

export default function ProjectDialog({ isOpen, editingProject, onCancel, onSubmit, projectDialogMessages }: Props) {
  const [projectName, setProjectName] = useState({
    text: editingProject ? editingProject.name : '',
    isInvalid: false,
    errorMessage: '',
  });

  const [projectDetail, setProjectDetail] = useState({
    text: editingProject ? editingProject.detail : '',
    isInvalid: false,
    errorMessage: '',
  });

  const [testUrl, setTestUrl] = useState({
    text: editingProject?.testUrl ?? '',
    isInvalid: false,
    errorMessage: '',
  });

  const [isProjectPublic, setIsProjectPublic] = useState(editingProject ? editingProject.isPublic : true);

  useEffect(() => {
    if (editingProject) {
      setProjectName({
        ...projectName,
        text: editingProject.name,
      });

      setProjectDetail({
        ...projectDetail,
        text: editingProject.detail ? editingProject.detail : '',
      });

      setTestUrl({ text: editingProject.testUrl ?? '', isInvalid: false, errorMessage: '' });

      setIsProjectPublic(editingProject.isPublic);
    } else {
      setProjectName({
        ...projectName,
        text: '',
      });

      setProjectDetail({
        ...projectDetail,
        text: '',
      });

      setIsProjectPublic(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProject]);

  const clear = () => {
    setProjectName({
      isInvalid: false,
      text: '',
      errorMessage: '',
    });
    setProjectDetail({
      isInvalid: false,
      text: '',
      errorMessage: '',
    });
    setTestUrl({
      isInvalid: false,
      text: '',
      errorMessage: '',
    });
  };

  const validate = () => {
    if (!projectName.text) {
      setProjectName({
        text: '',
        isInvalid: true,
        errorMessage: projectDialogMessages.pleaseEnter,
      });

      return;
    }

    // Le serveur refuse pour de bon ; cette vérification évite l'aller-retour et
    // dit où est l'erreur. Les deux sont nécessaires : celle-ci ne protège rien.
    const trimmedUrl = testUrl.text.trim();
    if (trimmedUrl !== '' && !/^https?:\/\//i.test(trimmedUrl)) {
      setTestUrl({
        text: testUrl.text,
        isInvalid: true,
        errorMessage: projectDialogMessages.testUrlInvalid,
      });

      return;
    }

    onSubmit(projectName.text, projectDetail.text, isProjectPublic, trimmedUrl);
    clear();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={() => {
        onCancel();
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">{projectDialogMessages.project}</ModalHeader>
        <ModalBody>
          <Input
            type="text"
            label={projectDialogMessages.projectName}
            value={projectName.text}
            isInvalid={projectName.isInvalid}
            errorMessage={projectName.errorMessage}
            onChange={(e) => {
              setProjectName({
                ...projectName,
                text: e.target.value,
              });
            }}
          />
          <Textarea
            label={projectDialogMessages.projectDetail}
            value={projectDetail.text}
            isInvalid={projectDetail.isInvalid}
            errorMessage={projectDetail.errorMessage}
            onChange={(e) => {
              setProjectDetail({
                ...projectDetail,
                text: e.target.value,
              });
            }}
          />
          <Input
            type="url"
            inputMode="url"
            label={projectDialogMessages.testUrl}
            placeholder="https://staging.exemple.com"
            description={projectDialogMessages.testUrlHint}
            value={testUrl.text}
            isInvalid={testUrl.isInvalid}
            errorMessage={testUrl.errorMessage}
            onChange={(e) => {
              setTestUrl({ text: e.target.value, isInvalid: false, errorMessage: '' });
            }}
          />
          <Checkbox isSelected={isProjectPublic} onValueChange={setIsProjectPublic}>
            {projectDialogMessages.public}
          </Checkbox>
          <div className="text-small text-default-500">{projectDialogMessages.ifYouMakePublic}</div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel}>
            {projectDialogMessages.close}
          </Button>
          <Button color="primary" onPress={validate}>
            {editingProject ? projectDialogMessages.update : projectDialogMessages.create}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
