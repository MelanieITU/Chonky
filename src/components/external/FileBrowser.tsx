import React, { useMemo } from 'react';
import shortid from 'shortid';

import { FileActionListener, FileArray } from '../..';
import { FileAction } from '../../types/file-actions.types';
import { ThumbnailGenerator } from '../../types/thumbnails.types';
import {
    ChonkyDisableSelectionContext,
    ChonkyDispatchFileActionContext,
    ChonkyDispatchSpecialActionContext,
    ChonkyDoubleClickDelayContext,
    ChonkyEnableDragAndDropContext,
    ChonkyFileActionsContext,
    ChonkyFileEntrySizeContext,
    ChonkyFilesContext,
    ChonkyFolderChainContext,
    ChonkyInstanceIdContext,
    ChonkySelectionContext,
    ChonkySelectionSizeContext,
    ChonkySelectionUtilContext,
    ChonkyThumbnailGeneratorContext,
    validateContextType,
} from '../../util/context';
import {
    DefaultFileActions,
    useFileActionDispatcher,
} from '../../util/file-actions-old';
import { useClickListener, useStaticValue } from '../../util/hooks-helpers';
import { useFilteredFiles, useSearch } from '../../util/search';
import { useSelection } from '../../util/selection';
import { useSpecialActionDispatcher } from '../../util/special-actions';
import {
    useFileActionsValidation,
    useFileArrayValidation,
} from '../../util/validation';
import { ContextComposer, ContextProviderData } from '../internal/ContextComposer';
import { DnDFileListDragLayer } from '../internal/DnDFileListDragLayer';
import { ErrorMessage } from '../internal/ErrorMessage';
import { DefaultEntrySize } from './FileList-virtualization';

export interface FileBrowserProps {
    /**
     * List of files that will be displayed in the main container. The provided value
     * **must** be an array, where each element is either `null` or an object that
     * satisfies the `FileData` type. If an element is `null`, a loading placeholder
     * will be displayed in its place.
     */
    files: FileArray;

    /**
     * The current folder hierarchy. This should be an array of `files`, every
     * element should either be `null` or an object of `FileData` type. The first
     * element should represent the top-level directory, and the last element
     * should be the current folder.
     */
    folderChain?: FileArray;

    fileActions?: FileAction[];
    onFileAction?: FileActionListener;

    /**
     * The function that determines the thumbnail image URL for a file. It gets a file object as the input, and
     * should return a `string` or `null`. It can also return a promise that resolves into a `string` or `null`.
     * [See relevant section](#section-displaying-file-thumbnails).
     */
    thumbnailGenerator?: ThumbnailGenerator;

    /**
     * Maximum delay between the two clicks in a double click, in milliseconds.
     */
    doubleClickDelay?: number;

    /**
     * The flag that completely disables file selection functionality. If any handlers depend on file selections, their
     * input will look like no files are selected.
     */
    disableSelection?: boolean;

    disableDefaultFileActions?: boolean;

    /**
     * The flag that completely disables drag & drop functionality.
     * [See relevant section](#section-managing-file-selection).
     */
    enableDragAndDrop?: boolean;

    /**
     * The flag that determines whether Chonky should fill the height parent container. When set to `true`, the maximum
     * height of the file browser will be limited to the height of the parent container, and scrollbar will be shown
     * when necessary. When set to `false`, file browser height will be extended to display all files at the same time.
     */
    fillParentContainer?: boolean;
}

export const FileBrowser: React.FC<FileBrowserProps> = (props) => {
    const { files, children } = props;

    // Instance ID used to distinguish between multiple Chonky instances on the same
    // page
    const chonkyInstanceId = useStaticValue(shortid.generate);

    //
    // ==== Default values assignment
    const folderChain = props.folderChain ? props.folderChain : null;
    const fileActions = props.fileActions ? props.fileActions : [];
    const onFileAction = props.onFileAction ? props.onFileAction : null;
    const thumbnailGenerator = props.thumbnailGenerator
        ? props.thumbnailGenerator
        : null;
    const doubleClickDelay =
        typeof props.doubleClickDelay === 'number' ? props.doubleClickDelay : 300;
    const disableSelection = !!props.disableSelection;
    const enableDragAndDrop = !!props.enableDragAndDrop;
    const disableDefaultFileActions = !!props.disableDefaultFileActions;

    //
    // ==== Input props validation
    const {
        cleanFiles,
        cleanFolderChain,
        errorMessages: fileArrayErrors,
    } = useFileArrayValidation(files, folderChain);
    const {
        cleanFileActions,
        errorMessages: fileActionsErrors,
    } = useFileActionsValidation(
        fileActions,
        DefaultFileActions,
        !disableDefaultFileActions
    );
    const validationErrors = [...fileArrayErrors, ...fileActionsErrors];

    //
    // ==== File array sorting | TODO: Come up with an API for customizable sorting...
    const sortedFiles = cleanFiles;

    //
    // ==== File search (aka file array filtering)
    const { searchState, searchContexts } = useSearch();
    const filteredFiles = useFilteredFiles(sortedFiles, searchState.searchFilter);

    //
    // ==== File selections
    const {
        selection,
        selectionSize,
        selectionUtilRef,
        selectionModifiers,
    } = useSelection(sortedFiles, disableSelection);

    //
    // ==== File actions - actions that users can customise as they please
    const dispatchFileAction = useFileActionDispatcher(cleanFileActions, onFileAction);

    //
    // ==== Special actions - special actions hard-coded into Chonky that users cannot
    //      customize (easily).
    const dispatchSpecialAction = useSpecialActionDispatcher(
        sortedFiles,
        selection,
        selectionUtilRef.current,
        selectionModifiers,
        searchState.setSearchBarVisible,
        dispatchFileAction
    );

    // Deal with clicks outside of Chonky
    const chonkyRootRef = useClickListener({
        onOutsideClick: selectionModifiers.clearSelection,
    });

    type ExtractContextType<P> = P extends React.Context<infer T> ? T : never;

    interface ContextData<ContextType extends React.Context<any>> {
        context: ContextType;
        value: ExtractContextType<ContextType>;
    }

    const contexts: ContextData<any>[] = [
        ...searchContexts,
        validateContextType({
            context: ChonkyInstanceIdContext,
            value: chonkyInstanceId,
        }),
        validateContextType({
            context: ChonkyFilesContext,
            value: filteredFiles,
        }),
        validateContextType({
            context: ChonkyFolderChainContext,
            value: cleanFolderChain,
        }),
        validateContextType({
            context: ChonkySelectionContext,
            value: selection,
        }),
        validateContextType({
            context: ChonkySelectionSizeContext,
            value: selectionSize,
        }),
        validateContextType({
            context: ChonkySelectionUtilContext,
            value: selectionUtilRef.current,
        }),
        validateContextType({
            context: ChonkyFileActionsContext,
            value: cleanFileActions,
        }),
        validateContextType({
            context: ChonkyDispatchFileActionContext,
            value: dispatchFileAction,
        }),
        validateContextType({
            context: ChonkyDispatchSpecialActionContext,
            value: dispatchSpecialAction,
        }),
        validateContextType({
            context: ChonkyThumbnailGeneratorContext,
            value: thumbnailGenerator,
        }),
        validateContextType({
            context: ChonkyDoubleClickDelayContext,
            value: doubleClickDelay,
        }),
        validateContextType({
            context: ChonkyFileEntrySizeContext,
            value: DefaultEntrySize,
        }),
        validateContextType({
            context: ChonkyDisableSelectionContext,
            value: disableSelection,
        }),
        validateContextType({
            context: ChonkyEnableDragAndDropContext,
            value: enableDragAndDrop,
        }),
    ];

    const contextProviders = useMemo<ContextProviderData[]>(
        () =>
            contexts.map((data) => ({
                provider: data.context.Provider,
                value: data.value,
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        contexts.map((data) => data.value)
    );

    return (
        <ContextComposer providers={contextProviders}>
            <div ref={chonkyRootRef} className="chonky-root chonky-no-select">
                {enableDragAndDrop && <DnDFileListDragLayer />}
                {validationErrors.map((data, index) => (
                    <ErrorMessage
                        key={`error-message-${index}`}
                        message={data.message}
                        bullets={data.bullets}
                    />
                ))}
                {children ? children : null}
            </div>
        </ContextComposer>
    );
};
