import { ContainerClient } from '@azure/storage-blob';
import { data } from 'dcmjs';
import { nanoid } from 'nanoid';
const { datasetToDict } = data;
import supabaseClient from './supabase';
const containerClient = new ContainerClient(process.env.AZURE_STORAGE_CONTAINER_SAS_URL);

export async function saveSeg(fileData: any, taskId: string) {
  try {
    let blob: Blob;
    if (fileData instanceof ArrayBuffer) {
      blob = new Blob([fileData], { type: 'application/dicom' });
    } else {
      if (!fileData._meta) {
        throw new Error('Dataset must have a _meta property');
      }
      const buffer = Buffer.from(datasetToDict(fileData).write());
      blob = new Blob([buffer], { type: 'application/dicom' });
    }
    const fileName = nanoid();

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    blockBlobClient.uploadData(blob).then(async () => {
      const { error } = await supabaseClient.from('hd_tasks_dicom_seg_files').insert({
        task_id: taskId,
        file_name: fileName,
      });

      if (error) {
        throw error;
      }

      return true;
    });
  } catch (error) {
    console.error('Error in saveSeg function:', error);
    return false;
  }
}

export async function removeSeg(taskId: string) {
  try {
    const { data, error: selectError } = await supabaseClient
      .from('hd_tasks_dicom_seg_files')
      .select('file_name') // Retrieve the blob name stored in file_name
      .eq('id', taskId)
      .single();

    if (selectError || !data || !data.file_name) {
      console.error(
        'Error retrieving blob name from Supabase:',
        selectError || 'Record or file_name not found.'
      );
      return false;
    }

    const blobName = data.file_name;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.delete();

    const { error: deleteError } = await supabaseClient.from('hd_seg').delete().eq('id', taskId);

    if (deleteError) {
      throw deleteError;
    }

    return true;
  } catch (error) {
    console.error('Error in removeSeg function:', error);
    return false;
  }
}

export async function getSeg(taskId: string): Promise<Blob> {
  try {
    const { data, error: selectError } = await supabaseClient
      .from('hd_tasks_dicom_seg_files')
      .select('file_name')
      .eq('task_id', taskId)
      .single();

    if (selectError || !data) {
      console.error('Error retrieving record from Supabase:', selectError || 'Record not found.');
      return null;
    }

    const fileName = data.file_name;

    if (!fileName) {
      console.error('MEGA file ID not found in Supabase record.');
      return null;
    }

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const dataStream = await blockBlobClient.download();
    return dataStream.blobBody
  } catch (error) {
    console.error('Error in getSeg function:', error);
    return null;
  }
}
